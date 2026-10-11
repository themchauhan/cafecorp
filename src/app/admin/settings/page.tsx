import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { GstSettingsForm } from './gst-settings-form';
import { TaxRateForm } from './tax-rate-form';

export default async function SettingsPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  let tenantId: string;
  try {
    requireRole(profile, ['ADMIN']);
    tenantId = requireTenantId(profile);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const tenantSnap = await adminDb.doc(`tenants/${tenantId}`).get();
  const tenantData = tenantSnap.data();
  const taxRatePercent = (tenantData?.taxRatePercent as number) ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <TaxRateForm initialTaxRatePercent={taxRatePercent} />
      <GstSettingsForm
        initialGstEnabled={(tenantData?.gstEnabled as boolean) ?? false}
        initialGstin={(tenantData?.gstin as string) ?? ''}
        initialGstLegalName={(tenantData?.gstLegalName as string) ?? ''}
        initialGstAddress={(tenantData?.gstAddress as string) ?? ''}
        initialGstSacCode={(tenantData?.gstSacCode as string) ?? ''}
      />
    </main>
  );
}
