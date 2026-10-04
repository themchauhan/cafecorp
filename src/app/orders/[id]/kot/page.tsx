import { notFound, redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { mapOrderDoc } from '../../lib';
import { PrintButton } from './print-button';

export default async function KotPage({
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

  const snap = await adminDb.doc(`tenants/${tenantId}/orders/${id}`).get();
  if (!snap.exists) {
    notFound();
  }
  const order = mapOrderDoc(
    snap.id,
    snap.data() as Parameters<typeof mapOrderDoc>[1],
  );

  if (order.status === 'OPEN') {
    redirect(`/orders/${order.id}`);
  }

  const tableLabel = order.tableId
    ? ((
        await adminDb
          .doc(`tenants/${tenantId}/cafeTables/${order.tableId}`)
          .get()
      ).data()?.label ?? order.tableId)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">KOT</h1>
        <PrintButton />
      </div>

      {/* No prices anywhere below — this is what the kitchen sees.
          Plain black-on-white regardless of screen: this prints on
          thermal/receipt paper, where colored backgrounds don't help. */}
      <div className="flex flex-col gap-2 border border-zinc-300 p-4 text-sm">
        <p className="font-medium">
          {order.orderType.replace('_', '-')}
          {tableLabel ? ` · ${tableLabel}` : ''}
        </p>
        <p className="text-zinc-500">
          {order.kotSentAt ? new Date(order.kotSentAt).toLocaleString() : ''}
        </p>
        <ul className="flex flex-col gap-1 border-t border-zinc-300 pt-2">
          {order.items.map((item, index) => (
            <li key={index}>
              {item.quantity} &times; {item.name}
              {item.notes ? ` (${item.notes})` : ''}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
