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
import {
  amountPaid,
  discountAmount,
  grandTotal,
  orderTotal,
  taxAmount,
} from '../../money';
import { PrintButton } from '../kot/print-button';

export default async function ReceiptPage({
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

  if (order.status !== 'BILLED') {
    redirect(`/orders/${order.id}`);
  }

  const subtotal = orderTotal(order.items);
  const discount = discountAmount(subtotal, order.discount);
  const tax = taxAmount(subtotal, order.discount, order.taxRatePercent);
  const total = grandTotal(order.items, order.discount, order.taxRatePercent);
  const paid = amountPaid(order.payments);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Receipt</h1>
        <PrintButton />
      </div>

      {/* Plain black-on-white — this prints on thermal/receipt paper. */}
      <div className="flex flex-col gap-2 border border-zinc-300 p-4 text-sm">
        <p className="font-medium">{order.orderType.replace('_', '-')}</p>
        <ul className="flex flex-col gap-1 border-t border-zinc-300 pt-2">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between">
              <span>
                {item.quantity} &times; {item.name}
              </span>
              <span>{(item.priceSnapshot * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 border-t border-zinc-300 pt-2">
          <p className="flex justify-between">
            <span>Subtotal</span>
            <span>{subtotal.toFixed(2)}</span>
          </p>
          {discount > 0 && (
            <p className="flex justify-between">
              <span>
                Discount
                {order.discount?.type === 'PERCENT'
                  ? ` (${order.discount.value}%)`
                  : ''}
              </span>
              <span>-{discount.toFixed(2)}</span>
            </p>
          )}
          {tax > 0 && (
            <p className="flex justify-between">
              <span>Tax ({order.taxRatePercent}%)</span>
              <span>{tax.toFixed(2)}</span>
            </p>
          )}
          <p className="flex justify-between font-medium">
            <span>Total</span>
            <span>{total.toFixed(2)}</span>
          </p>
        </div>
        <ul className="flex flex-col gap-1 border-t border-zinc-300 pt-2 text-zinc-600">
          {order.payments.map((payment, index) => (
            <li key={index} className="flex justify-between">
              <span>Paid via {payment.mode}</span>
              <span>{payment.amount.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between text-zinc-600">
          <span>Amount paid</span>
          <span>{paid.toFixed(2)}</span>
        </p>
      </div>
    </main>
  );
}
