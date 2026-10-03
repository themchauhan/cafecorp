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
    <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <div className="text-sm">
        <p>Paid so far: {paid.toFixed(2)}</p>
        <p className="font-medium">Balance due: {balance.toFixed(2)}</p>
      </div>

      {order.payments.length > 0 && (
        <ul className="text-sm text-zinc-600 dark:text-zinc-400">
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
          className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as OrderPayment['mode'])
          }
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {loading ? 'Recording…' : 'Record payment'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded border border-red-600 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
          >
            Confirm cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowCancel(true)}
          className="self-start text-sm text-red-600 underline underline-offset-4"
        >
          Cancel order
        </button>
      )}
    </section>
  );
}
