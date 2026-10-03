import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import type { Category, MenuItem } from '@/app/admin/menu/types';
import { mapOrderDoc } from '../lib';
import { amountPaid, orderTotal } from '../money';
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
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
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

  const total = orderTotal(order.items);
  const paid = amountPaid(order.payments);
  const tableLabel = order.tableId
    ? ((
        await adminDb
          .doc(`tenants/${tenantId}/cafeTables/${order.tableId}`)
          .get()
      ).data()?.label ?? order.tableId)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {order.orderType.replace('_', '-')}
        {tableLabel ? ` · ${tableLabel}` : ''} order &middot; {order.status}
      </h1>
      <ul className="flex flex-col gap-1 text-sm">
        {order.items.map((item, index) => (
          <li key={index} className="flex justify-between">
            <span>
              {item.quantity} &times; {item.name}
            </span>
            <span>{(item.priceSnapshot * item.quantity).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-zinc-200 pt-2 text-sm font-medium dark:border-zinc-800">
        Total: {total.toFixed(2)}
      </p>
      <Link
        href={`/orders/${order.id}/kot`}
        className="text-sm underline underline-offset-4"
      >
        View KOT
      </Link>

      {(order.status === 'KOT_SENT' || order.status === 'SERVED') && (
        <BillPanel order={order} total={total} paid={paid} />
      )}

      {order.status === 'BILLED' && (
        <Link
          href={`/orders/${order.id}/receipt`}
          className="text-sm underline underline-offset-4"
        >
          View receipt
        </Link>
      )}

      {order.status === 'CANCELLED' && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Cancelled: {order.cancelReason}
        </p>
      )}
    </main>
  );
}
