'use server';

import { revalidatePath } from 'next/cache';
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

async function requireMenuAdmin() {
  const profile = requireRole(await getSessionProfile(), ['ADMIN']);
  await requireActiveTenant(profile);
  return { profile, tenantId: requireTenantId(profile) };
}

const categorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int(),
});

export async function createCategory(input: {
  name: string;
  sortOrder: number;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireMenuAdmin();
    const data = categorySchema.parse(input);

    const ref = await adminDb
      .collection(`tenants/${tenantId}/menuCategories`)
      .add(data);
    await logAudit(
      profile,
      'MENU_CATEGORY_CREATED',
      'menuCategory',
      ref.id,
      data,
    );
    revalidatePath('/admin/menu');
  });
}

const updateCategorySchema = categorySchema.extend({ id: z.string().min(1) });

export async function updateCategory(input: {
  id: string;
  name: string;
  sortOrder: number;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireMenuAdmin();
    const { id, ...data } = updateCategorySchema.parse(input);

    const ref = adminDb.doc(`tenants/${tenantId}/menuCategories/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No such category in this tenant');

    await ref.update(data);
    await logAudit(profile, 'MENU_CATEGORY_UPDATED', 'menuCategory', id, data);
    revalidatePath('/admin/menu');
    revalidatePath(`/admin/menu/categories/${id}/edit`);
  });
}

const itemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().positive(),
  vegFlag: z.boolean(),
  description: z.string().optional().default(''),
});

async function assertCategoryInTenant(tenantId: string, categoryId: string) {
  const snap = await adminDb
    .doc(`tenants/${tenantId}/menuCategories/${categoryId}`)
    .get();
  if (!snap.exists) {
    throw new Error('No such category in this tenant');
  }
}

export async function createMenuItem(input: {
  categoryId: string;
  name: string;
  price: number;
  vegFlag: boolean;
  description?: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireMenuAdmin();
    const data = itemSchema.parse(input);
    await assertCategoryInTenant(tenantId, data.categoryId);

    const ref = await adminDb
      .collection(`tenants/${tenantId}/menuItems`)
      .add({ ...data, available: true });
    await logAudit(profile, 'MENU_ITEM_CREATED', 'menuItem', ref.id, data);
    revalidatePath('/admin/menu');
  });
}

const updateItemSchema = itemSchema.extend({ id: z.string().min(1) });

export async function updateMenuItem(input: {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  vegFlag: boolean;
  description?: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireMenuAdmin();
    const { id, ...data } = updateItemSchema.parse(input);
    await assertCategoryInTenant(tenantId, data.categoryId);

    const ref = adminDb.doc(`tenants/${tenantId}/menuItems/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No such menu item in this tenant');

    await ref.update(data);
    await logAudit(profile, 'MENU_ITEM_UPDATED', 'menuItem', id, data);
    revalidatePath('/admin/menu');
    revalidatePath(`/admin/menu/items/${id}/edit`);
  });
}

const availabilitySchema = z.object({
  id: z.string().min(1),
  available: z.boolean(),
});

export async function setMenuItemAvailability(input: {
  id: string;
  available: boolean;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireMenuAdmin();
    const { id, available } = availabilitySchema.parse(input);

    const ref = adminDb.doc(`tenants/${tenantId}/menuItems/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No such menu item in this tenant');

    await ref.update({ available });
    await logAudit(
      profile,
      available ? 'MENU_ITEM_ENABLED' : 'MENU_ITEM_DISABLED',
      'menuItem',
      id,
      {},
    );
    revalidatePath('/admin/menu');
  });
}
