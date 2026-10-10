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
import {
  dailySummaryDocPath,
  dateKeyForDate,
  hourKeyForDate,
} from '@/lib/daily-summary';
import { amountPaid, grandTotal } from './money';
import type { OrderDiscount, OrderLineItem, OrderPayment } from './types';

async function requireStaffOrAdmin() {
  const profile = requireRole(await getSessionProfile(), ['ADMIN', 'STAFF']);
  await requireActiveTenant(profile);
  return { profile, tenantId: requireTenantId(profile) };
}

const BILLABLE_STATUSES = new Set(['OPEN', 'KOT_SENT', 'SERVED']);

const addPaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  mode: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']),
});

export async function addPayment(input: {
  orderId: string;
  amount: number;
  mode: 'CASH' | 'UPI' | 'CARD' | 'OTHER';
}): Promise<ActionResult<{ billed: boolean }>> {
  return runAction(async () => {
    const { profile, tenantId } = await requireStaffOrAdmin();
    const { orderId, amount, mode } = addPaymentSchema.parse(input);

    const orderRef = adminDb.doc(`tenants/${tenantId}/orders/${orderId}`);
    let billed = false;

    await adminDb.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new Error('No such order in this tenant');
      const order = orderSnap.data() as {
        status: string;
        items: OrderLineItem[];
        payments: OrderPayment[];
        discount?: OrderDiscount;
        taxRatePercent?: number;
      };
      if (!BILLABLE_STATUSES.has(order.status)) {
        throw new Error('This order can no longer accept payments');
      }

      const payment: OrderPayment = {
        amount,
        mode,
        receivedBy: profile.uid,
        receivedAt: new Date().toISOString(), // serverTimestamp() isn't allowed inside arrays
      };
      const payments = [...order.payments, payment];
      // Discount/tax-adjusted, not the raw item subtotal — a staff
      // member must collect what's actually owed, not just the
      // pre-tax/pre-discount sum of the line items.
      const total = grandTotal(
        order.items,
        order.discount ?? null,
        order.taxRatePercent ?? 0,
      );
      billed = amountPaid(payments) >= total;

      if (!billed) {
        tx.update(orderRef, { payments });
        return;
      }

      // Distinct menuItemIds referenced by this order, to look up each
      // line's category for categorySales — read before any write,
      // since Firestore transactions require all reads up front.
      const menuItemIds = [
        ...new Set(order.items.map((item) => item.menuItemId)),
      ];
      const menuItemSnaps = await Promise.all(
        menuItemIds.map((id) =>
          tx.get(adminDb.doc(`tenants/${tenantId}/menuItems/${id}`)),
        ),
      );
      const categoryByMenuItemId = new Map<string, string>();
      menuItemSnaps.forEach((snap, i) => {
        const categoryId = snap.exists
          ? (snap.data()?.categoryId as string)
          : undefined;
        if (categoryId) categoryByMenuItemId.set(menuItemIds[i], categoryId);
      });

      tx.update(orderRef, {
        payments,
        status: 'BILLED',
        billedAt: FieldValue.serverTimestamp(),
      });

      // Sum same-key contributions locally first (e.g. two CASH
      // payments in one split bill) before turning each into a single
      // increment() — otherwise a second assignment to the same object
      // key would just overwrite the first increment() sentinel rather
      // than adding to it.
      const modeTotals = new Map<string, number>();
      const staffTotals = new Map<string, number>();
      for (const p of payments) {
        modeTotals.set(p.mode, (modeTotals.get(p.mode) ?? 0) + p.amount);
        staffTotals.set(
          p.receivedBy,
          (staffTotals.get(p.receivedBy) ?? 0) + p.amount,
        );
      }
      const itemTotals = new Map<string, number>();
      const categoryTotals = new Map<string, number>();
      for (const item of order.items) {
        itemTotals.set(
          item.menuItemId,
          (itemTotals.get(item.menuItemId) ?? 0) + item.quantity,
        );
        const categoryId = categoryByMenuItemId.get(item.menuItemId);
        if (categoryId) {
          categoryTotals.set(
            categoryId,
            (categoryTotals.get(categoryId) ?? 0) +
              item.priceSnapshot * item.quantity,
          );
        }
      }

      function toIncrementMap(
        totals: Map<string, number>,
      ): Record<string, FieldValue> {
        return Object.fromEntries(
          [...totals].map(([key, value]) => [key, FieldValue.increment(value)]),
        );
      }

      // A real nested object, not a flat object with dotted-string keys
      // — set(..., {merge: true}) does NOT split dots in a key into a
      // field path the way update() does; it would otherwise write a
      // literal field named e.g. "totalsByMode.CASH".
      const now = new Date();
      const summaryUpdate = {
        totalsByMode: toIncrementMap(modeTotals),
        totalsByStaff: toIncrementMap(staffTotals),
        itemsSold: toIncrementMap(itemTotals),
        categorySales: toIncrementMap(categoryTotals),
        ordersByHour: { [hourKeyForDate(now)]: FieldValue.increment(1) },
      };
      const dateKey = dateKeyForDate(now);
      tx.set(
        adminDb.doc(dailySummaryDocPath(tenantId, dateKey)),
        summaryUpdate,
        {
          merge: true,
        },
      );
    });

    await logAudit(profile, 'ORDER_PAYMENT_ADDED', 'order', orderId, {
      amount,
      mode,
      billed,
    });
    revalidatePath(`/orders/${orderId}`);
    return { billed };
  });
}

const applyDiscountSchema = z.object({
  orderId: z.string().min(1),
  discount: z
    .object({
      type: z.enum(['FLAT', 'PERCENT']),
      value: z.number().positive(),
    })
    .nullable(),
});

/** Set to null to remove a previously-applied discount before billing. */
export async function applyDiscount(input: {
  orderId: string;
  discount: OrderDiscount;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireStaffOrAdmin();
    const { orderId, discount } = applyDiscountSchema.parse(input);
    const orderRef = adminDb.doc(`tenants/${tenantId}/orders/${orderId}`);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error('No such order in this tenant');
      const order = snap.data() as { status: string };
      if (!BILLABLE_STATUSES.has(order.status)) {
        throw new Error('This order can no longer be discounted');
      }
      tx.update(orderRef, { discount });
    });

    await logAudit(profile, 'ORDER_DISCOUNT_APPLIED', 'order', orderId, {
      discount,
    });
    revalidatePath(`/orders/${orderId}`);
  });
}

const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().min(1),
});

export async function cancelOrder(input: {
  orderId: string;
  reason: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireStaffOrAdmin();
    const { orderId, reason } = cancelOrderSchema.parse(input);
    const orderRef = adminDb.doc(`tenants/${tenantId}/orders/${orderId}`);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error('No such order in this tenant');
      const order = snap.data() as { status: string };
      if (order.status === 'BILLED' || order.status === 'CANCELLED') {
        throw new Error(
          `Cannot cancel an order that is already ${order.status}`,
        );
      }
      tx.update(orderRef, { status: 'CANCELLED', cancelReason: reason });
    });

    await logAudit(profile, 'ORDER_CANCELLED', 'order', orderId, { reason });
    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/orders');
  });
}
