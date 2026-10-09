import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { StatusBadge } from '@/components/status-badge';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import type { Category, MenuItem } from '@/app/admin/menu/types';
import { mapOrderDoc } from '../lib';
import { orderTotal } from '../money';
import { OrderBuilder } from './order-builder';
import { BillPanel } from './bill-panel';

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const orderSnap = await adminDb.doc(`tenants/${tenantId}/orders/${id}`).get();
  if (!orderSnap.exists) {
    notFound();
  }
  const order = mapOrderDoc(
    orderSnap.id,
    orderSnap.data() as Parameters<typeof mapOrderDoc>[1],
  );

  if (order.status === 'OPEN') {
    const [categoriesSnap, itemsSnap] = await Promise.all([
      adminDb
        .collection(`tenants/${tenantId}/menuCategories`)
        .orderBy('sortOrder')
        .get(),
      adminDb
        .collection(`tenants/${tenantId}/menuItems`)
        .where('available', '==', true)
        .get(),
    ]);
    const categories: Category[] = categoriesSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Category, 'id'>),
    }));
    const menuItems: MenuItem[] = itemsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<MenuItem, 'id'>),
    }));

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {order.orderType.replace('_', '-')} order
        </h1>
        <OrderBuilder
          order={order}
          categories={categories}
          menuItems={menuItems}
        />
      </main>
    );
  }

  const subtotal = orderTotal(order.items);
  const tableLabel = order.tableId
    ? ((
        await adminDb
          .doc(`tenants/${tenantId}/cafeTables/${order.tableId}`)
          .get()
      ).data()?.label ?? order.tableId)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {order.orderType.replace('_', '-')}
          {tableLabel ? ` · ${tableLabel}` : ''}
        </h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <ul className="flex flex-col gap-2 text-sm">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between">
              <span>
                {item.quantity} &times; {item.name}
              </span>
              <span className="font-medium">
                {(item.priceSnapshot * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between border-t border-[var(--border)] pt-3 text-lg font-bold">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)}</span>
        </p>
      </div>

      <Link
        href={`/orders/${order.id}/kot`}
        className="btn btn-secondary self-start"
      >
        View KOT
      </Link>

      {(order.status === 'KOT_SENT' || order.status === 'SERVED') && (
        <BillPanel order={order} />
      )}

      {order.status === 'BILLED' && (
        <Link
          href={`/orders/${order.id}/receipt`}
          className="btn btn-secondary self-start"
        >
          View receipt
        </Link>
      )}

      {order.status === 'CANCELLED' && (
        <p className="card p-4 text-sm text-[var(--muted)]">
          Cancelled: {order.cancelReason}
        </p>
      )}
    </main>
  );
}
