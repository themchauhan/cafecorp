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

const updateTaxRateSchema = z.object({
  taxRatePercent: z.number().min(0).max(100),
});

export async function updateTaxRate(input: {
  taxRatePercent: number;
}): Promise<ActionResult> {
  return runAction(async () => {
    const profile = requireRole(await getSessionProfile(), ['ADMIN']);
    await requireActiveTenant(profile);
    const tenantId = requireTenantId(profile);
    const { taxRatePercent } = updateTaxRateSchema.parse(input);

    await adminDb
      .doc(`tenants/${tenantId}`)
      .set({ taxRatePercent }, { merge: true });

    await logAudit(profile, 'TAX_RATE_UPDATED', 'tenant', tenantId, {
      taxRatePercent,
    });
    revalidatePath('/admin/settings');
  });
}
