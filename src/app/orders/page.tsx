import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">New order</h1>
        <NewOrderForm activeTables={activeTables} />
      </section>

      <section className="flex flex-col gap-3 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-lg font-medium">In progress</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No open orders right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <span>
                    {order.orderType}
                    {order.tableId
                      ? ` · ${tableLabel.get(order.tableId) ?? order.tableId}`
                      : ''}
                    {' · '}
                    {order.items.length} item
                    {order.items.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {order.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
