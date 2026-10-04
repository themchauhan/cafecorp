import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { StatusBadge } from '@/components/status-badge';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import type { CafeTable } from '@/app/admin/tables/types';
import { NewOrderForm } from './new-order-form';
import { mapOrderDoc } from './lib';

export default async function OrdersPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  let tenantId: string;
  try {
    requireRole(profile, ['ADMIN', 'STAFF']);
    tenantId = requireTenantId(profile);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const [ordersSnap, tablesSnap] = await Promise.all([
    adminDb
      .collection(`tenants/${tenantId}/orders`)
      .where('status', 'in', ['OPEN', 'KOT_SENT', 'SERVED'])
      .get(),
    adminDb
      .collection(`tenants/${tenantId}/cafeTables`)
      .where('active', '==', true)
      .get(),
  ]);
  const orders = ordersSnap.docs
    .map((doc) =>
      mapOrderDoc(doc.id, doc.data() as Parameters<typeof mapOrderDoc>[1]),
    )
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const activeTables: CafeTable[] = tablesSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<CafeTable, 'id'>) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const tableLabel = new Map(
    activeTables.map((table) => [table.id, table.label]),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">New order</h1>
        <NewOrderForm activeTables={activeTables} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">In progress</h2>
        {orders.length === 0 ? (
          <p className="card p-6 text-sm text-[var(--muted)]">
            No open orders right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="card flex min-h-16 items-center justify-between gap-2 px-4 py-3 hover:border-[var(--color-brand-500)]"
                >
                  <span className="font-medium">
                    {order.orderType.replace('_', '-')}
                    {order.tableId
                      ? ` · ${tableLabel.get(order.tableId) ?? order.tableId}`
                      : ''}
                    {' · '}
                    {order.items.length} item
                    {order.items.length === 1 ? '' : 's'}
                  </span>
                  <StatusBadge status={order.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
