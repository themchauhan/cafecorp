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

async function requireTablesAdmin() {
  const profile = requireRole(await getSessionProfile(), ['ADMIN']);
  await requireActiveTenant(profile);
  return { profile, tenantId: requireTenantId(profile) };
}

const createTableSchema = z.object({ label: z.string().min(1) });

export async function createTable(input: {
  label: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireTablesAdmin();
    const { label } = createTableSchema.parse(input);

    const ref = await adminDb
      .collection(`tenants/${tenantId}/cafeTables`)
      .add({ label, active: true });
    await logAudit(profile, 'TABLE_CREATED', 'cafeTable', ref.id, { label });
    revalidatePath('/admin/tables');
  });
}

const updateTableSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export async function updateTable(input: {
  id: string;
  label: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireTablesAdmin();
    const { id, label } = updateTableSchema.parse(input);

    const ref = adminDb.doc(`tenants/${tenantId}/cafeTables/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No such table in this tenant');

    await ref.update({ label });
    await logAudit(profile, 'TABLE_UPDATED', 'cafeTable', id, { label });
    revalidatePath('/admin/tables');
  });
}

const setActiveSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

export async function setTableActive(input: {
  id: string;
  active: boolean;
}): Promise<ActionResult> {
  return runAction(async () => {
    const { profile, tenantId } = await requireTablesAdmin();
    const { id, active } = setActiveSchema.parse(input);

    const ref = adminDb.doc(`tenants/${tenantId}/cafeTables/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No such table in this tenant');

    await ref.update({ active });
    await logAudit(
      profile,
      active ? 'TABLE_ACTIVATED' : 'TABLE_DEACTIVATED',
      'cafeTable',
      id,
      {},
    );
    revalidatePath('/admin/tables');
  });
}
