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
import { DEFAULT_SAC_CODE, isValidGstin } from '@/lib/gst';

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

const updateGstSettingsSchema = z.object({
  gstEnabled: z.boolean(),
  gstin: z.string().trim(),
  gstLegalName: z.string().trim(),
  gstAddress: z.string().trim(),
  gstSacCode: z.string().trim(),
});

/**
 * Regular GST scheme only (a real Tax Invoice — GSTIN, serial invoice
 * number, CGST+SGST breakup). When `gstEnabled` is false this clears
 * the other fields rather than leaving stale values sitting in
 * Settings — re-enabling later starts from a blank form on purpose.
 */
export async function updateGstSettings(input: {
  gstEnabled: boolean;
  gstin: string;
  gstLegalName: string;
  gstAddress: string;
  gstSacCode: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const profile = requireRole(await getSessionProfile(), ['ADMIN']);
    await requireActiveTenant(profile);
    const tenantId = requireTenantId(profile);
    const { gstEnabled, gstin, gstLegalName, gstAddress, gstSacCode } =
      updateGstSettingsSchema.parse(input);

    if (!gstEnabled) {
      await adminDb.doc(`tenants/${tenantId}`).set(
        {
          gstEnabled: false,
          gstin: null,
          gstLegalName: null,
          gstAddress: null,
          gstSacCode: null,
        },
        { merge: true },
      );
      await logAudit(profile, 'GST_SETTINGS_UPDATED', 'tenant', tenantId, {
        gstEnabled: false,
      });
      revalidatePath('/admin/settings');
      return;
    }

    if (!isValidGstin(gstin.toUpperCase())) {
      throw new Error(
        'That GSTIN doesn’t look right (expected 15 characters, e.g. 09AAACH7409R1ZZ)',
      );
    }
    if (!gstLegalName) {
      throw new Error('Enter the registered business name for the invoice');
    }
    if (!gstAddress) {
      throw new Error('Enter the registered business address for the invoice');
    }

    await adminDb.doc(`tenants/${tenantId}`).set(
      {
        gstEnabled: true,
        gstin: gstin.toUpperCase(),
        gstLegalName,
        gstAddress,
        gstSacCode: gstSacCode || DEFAULT_SAC_CODE,
      },
      { merge: true },
    );

    await logAudit(profile, 'GST_SETTINGS_UPDATED', 'tenant', tenantId, {
      gstEnabled: true,
    });
    revalidatePath('/admin/settings');
  });
}
