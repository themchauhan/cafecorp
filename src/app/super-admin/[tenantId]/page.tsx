import { notFound, redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import { AuthError, getSessionProfile, requireRole } from '@/lib/auth/session';
import { isTenantCurrentlyActive } from '@/lib/tenant';
import type { SubscriptionPayment, Tenant } from '../types';
import { TenantAdminPanel } from './tenant-admin-panel';

export default async function SuperAdminTenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  try {
    requireRole(profile, ['SUPER_ADMIN']);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const [tenantSnap, paymentsSnap] = await Promise.all([
    adminDb.doc(`tenants/${tenantId}`).get(),
    adminDb
      .collection('subscriptionPayments')
      .where('tenantId', '==', tenantId)
      .get(),
  ]);
  if (!tenantSnap.exists) {
    notFound();
  }
  const tenant: Tenant = {
    id: tenantSnap.id,
    ...(tenantSnap.data() as Omit<Tenant, 'id'>),
  };
  const payments: SubscriptionPayment[] = paymentsSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        amount: data.amount,
        paymentDate: data.paymentDate?.toDate?.().toISOString() ?? '',
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        notes: data.notes ?? '',
      } satisfies SubscriptionPayment;
    })
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
        <p className="text-sm text-[var(--muted)]">
          {tenant.email} &middot; {tenant.phone}
        </p>
        <p className="text-sm font-medium">
          {isTenantCurrentlyActive(tenant)
            ? 'Active'
            : 'Restricted (read-only for its staff)'}
        </p>
      </div>

      <TenantAdminPanel tenant={tenant} payments={payments} />
    </main>
  );
}
