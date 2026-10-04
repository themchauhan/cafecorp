'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { addPayment, cancelOrder } from '../billing-actions';
import type { Order, OrderPayment } from '../types';

const PAYMENT_MODES: OrderPayment['mode'][] = ['CASH', 'UPI', 'CARD', 'OTHER'];

export function BillPanel({
  order,
  total,
  paid,
}: {
  order: Order;
  total: number;
  paid: number;
}) {
  const router = useRouter();
  const balance = total - paid;
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : '');
  const [mode, setMode] = useState<OrderPayment['mode']>('CASH');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePayment(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await addPayment({
      orderId: order.id,
      amount: Number(amount),
      mode,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function handleCancel(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await cancelOrder({
      orderId: order.id,
      reason: cancelReason,
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <section className="card flex flex-col gap-4 p-4">
      <div>
        <p className="text-sm text-[var(--muted)]">
          Paid so far: {paid.toFixed(2)}
        </p>
        <p className="text-lg font-bold">Balance due: {balance.toFixed(2)}</p>
      </div>

      {order.payments.length > 0 && (
        <ul className="text-sm text-[var(--muted)]">
          {order.payments.map((payment, index) => (
            <li key={index}>
              {payment.amount.toFixed(2)} via {payment.mode}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handlePayment} className="flex flex-wrap items-end gap-2">
        <input
          type="number"
          required
          min="0.01"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="input w-32"
        />
        <select
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as OrderPayment['mode'])
          }
          className="input w-auto"
        >
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Recording…' : 'Record payment'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
      )}

      {showCancel ? (
        <form
          onSubmit={handleCancel}
          className="flex flex-wrap items-end gap-2"
        >
          <input
            type="text"
            required
            placeholder="Reason for cancelling"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            className="input flex-1"
          />
          <button type="submit" disabled={loading} className="btn btn-danger">
            Confirm cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowCancel(true)}
          className="btn btn-danger self-start"
        >
          Cancel order
        </button>
      )}
    </section>
  );
}
