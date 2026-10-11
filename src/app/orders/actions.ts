'use server';

import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { type ActionResult, runAction } from '@/lib/action-result';
import { logAudit } from '@/lib/auth/audit';
import {
  getSessionProfile,
  requireActiveTenant,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { dateKeyForDate } from '@/lib/daily-summary';
import { DEFAULT_SAC_CODE } from '@/lib/gst';
import type { OrderLineItem } from './types';

async function requireStaffOrAdmin() {
  const profile = requireRole(await getSessionProfile(), ['ADMIN', 'STAFF']);
  await requireActiveTenant(profile);
  return { profile, tenantId: requireTenantId(profile) };
}

const createOrderSchema = z.object({
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'PARCEL']),
  tableId: z.string().optional(),
});

export async function createOrder(input: {
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'PARCEL';
  tableId?: string;
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { profile, tenantId } = await requireStaffOrAdmin();
    const { orderType, tableId } = createOrderSchema.parse(input);

    // A table is required for DINE_IN (Phase 5) and always re-checked
    // against the caller's own tenant + active status — never trusted
    // from the client beyond its bare id.
    if (orderType === 'DINE_IN') {
      if (!tableId) {
        throw new Error('Choose a table for a dine-in order');
      }
      const tableSnap = await adminDb
        .doc(`tenants/${tenantId}/cafeTables/${tableId}`)
        .get();
      if (!tableSnap.exists || tableSnap.data()?.active !== true) {
        throw new Error('That table is not available');
      }
    }

    // Snapshotted now, not read again at billing time — a tax-rate
    // (or GST settings) change in Settings must never alter an order
    // already in flight (CLAUDE.md rule 9's reasoning extended to tax,
    // not just price).
    const tenantSnap = await adminDb.doc(`tenants/${tenantId}`).get();
    const tenantData = tenantSnap.data();
    const taxRatePercent = (tenantData?.taxRatePercent as number) ?? 0;
    const gstEnabled = (tenantData?.gstEnabled as boolean) ?? false;
    const gstin = gstEnabled ? ((tenantData?.gstin as string) ?? null) : null;
    const gstLegalName = gstEnabled
      ? ((tenantData?.gstLegalName as string) ?? null)
      : null;
    const gstAddress = gstEnabled
      ? ((tenantData?.gstAddress as string) ?? null)
      : null;
    const gstSacCode = gstEnabled
      ? ((tenantData?.gstSacCode as string) ?? DEFAULT_SAC_CODE)
      : null;

    // Daily, per-tenant ticket number ("Order #7"), distinct from the
    // Firestore doc id — assigned via a transaction on a tiny counter
    // doc so two orders created at the same instant never collide.
    const ref = adminDb.collection(`tenants/${tenantId}/orders`).doc();
    const counterRef = adminDb.doc(
      `tenants/${tenantId}/ticketCounters/${dateKeyForDate(new Date())}`,
    );
    const ticketNumber = await adminDb.runTransaction(async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const next = ((counterSnap.data()?.count as number) ?? 0) + 1;
      tx.set(counterRef, { count: next });
      tx.set(ref, {
        ticketNumber: next,
        orderType,
        tableId: orderType === 'DINE_IN' ? tableId : null,
        status: 'OPEN',
        items: [],
        payments: [],
        taxRatePercent,
        discount: null,
        gstEnabled,
        gstin,
        gstLegalName,
        gstAddress,
        gstSacCode,
        gstInvoiceNumber: null,
        cancelReason: null,
        createdBy: profile.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return next;
    });

    await logAudit(profile, 'ORDER_CREATED', 'order', ref.id, {
      orderType,
      tableId,
      ticketNumber,
    });
    revalidatePath('/orders');
    return { id: ref.id };
  });
}

const addItemSchema = z.object({
  orderId: z.string().min(1),
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export async function addOrderItem(input: {
  orderId: string;
  menuItemId: string;
  quantity: number;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireStaffOrAdmin();
    const { orderId, menuItemId, quantity } = addItemSchema.parse(input);

    const orderRef = adminDb.doc(`tenants/${tenantId}/orders/${orderId}`);
    const itemRef = adminDb.doc(`tenants/${tenantId}/menuItems/${menuItemId}`);

    await adminDb.runTransaction(async (tx) => {
      const [orderSnap, itemSnap] = await Promise.all([
        tx.get(orderRef),
        tx.get(itemRef),
      ]);
      if (!orderSnap.exists) throw new Error('No such order in this tenant');
      if (!itemSnap.exists) throw new Error('No such menu item in this tenant');

      const order = orderSnap.data() as {
        status: string;
        items: OrderLineItem[];
      };
      if (order.status !== 'OPEN') {
        throw new Error("Can only add items to an order that's still open");
      }
      const menuItem = itemSnap.data() as {
        name: string;
        price: number;
        available: boolean;
      };
      if (!menuItem.available) {
        throw new Error('This item is currently unavailable');
      }

      const items = [...order.items];
      const existingIndex = items.findIndex(
        (line) => line.menuItemId === menuItemId,
      );
      if (existingIndex >= 0) {
        items[existingIndex] = {
          ...items[existingIndex],
          quantity: items[existingIndex].quantity + quantity,
        };
      } else {
        items.push({
          menuItemId,
          name: menuItem.name,
          quantity,
          priceSnapshot: menuItem.price,
          notes: '',
        });
      }
      tx.update(orderRef, { items });
    });

    await logAudit(profile, 'ORDER_ITEM_ADDED', 'order', orderId, {
      menuItemId,
      quantity,
    });
    revalidatePath(`/orders/${orderId}`);
  });
}

const updateQuantitySchema = z.object({
  orderId: z.string().min(1),
  index: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
});

/** Sets a line item's quantity directly; 0 removes the line. */
export async function updateOrderItemQuantity(input: {
  orderId: string;
  index: number;
  quantity: number;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireStaffOrAdmin();
    const { orderId, index, quantity } = updateQuantitySchema.parse(input);
    const orderRef = adminDb.doc(`tenants/${tenantId}/orders/${orderId}`);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error('No such order in this tenant');
      const order = snap.data() as { status: string; items: OrderLineItem[] };
      if (order.status !== 'OPEN') {
        throw new Error("Can only edit items on an order that's still open");
      }
      if (index < 0 || index >= order.items.length) {
        throw new Error('No such line item');
      }
      const items = [...order.items];
      if (quantity === 0) {
        items.splice(index, 1);
      } else {
        items[index] = { ...items[index], quantity };
      }
      tx.update(orderRef, { items });
    });

    await logAudit(profile, 'ORDER_ITEM_UPDATED', 'order', orderId, {
      index,
      quantity,
    });
    revalidatePath(`/orders/${orderId}`);
  });
}

export async function sendToKitchen(orderId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireStaffOrAdmin();
    const id = z.string().min(1).parse(orderId);
    const orderRef = adminDb.doc(`tenants/${tenantId}/orders/${id}`);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error('No such order in this tenant');
      const order = snap.data() as { status: string; items: unknown[] };
      if (order.status !== 'OPEN') {
        throw new Error('This order has already been sent or closed');
      }
      if (order.items.length === 0) {
        throw new Error('Add at least one item before sending to the kitchen');
      }
      tx.update(orderRef, {
        status: 'KOT_SENT',
        kotSentAt: FieldValue.serverTimestamp(),
      });
    });

    await logAudit(profile, 'ORDER_KOT_SENT', 'order', id, {});
    revalidatePath(`/orders/${id}`);
    revalidatePath(`/orders/${id}/kot`);
    revalidatePath('/orders');
  });
}

/** Kitchen marks a ticket ready to serve (KOT_SENT -> SERVED). */
export async function markOrderReady(orderId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireStaffOrAdmin();
    const id = z.string().min(1).parse(orderId);
    const orderRef = adminDb.doc(`tenants/${tenantId}/orders/${id}`);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error('No such order in this tenant');
      const order = snap.data() as { status: string };
      if (order.status !== 'KOT_SENT') {
        throw new Error('Only a ticket in the kitchen can be marked ready');
      }
      tx.update(orderRef, {
        status: 'SERVED',
        servedAt: FieldValue.serverTimestamp(),
      });
    });

    await logAudit(profile, 'ORDER_MARKED_READY', 'order', id, {});
    revalidatePath(`/orders/${id}`);
    revalidatePath('/orders');
    revalidatePath('/kitchen');
  });
}
