'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { addPayment, applyDiscount, cancelOrder } from '../billing-actions';
import {
  amountPaid,
  discountAmount,
  grandTotal,
  orderTotal,
  taxAmount,
} from '../money';
import type { Order, OrderDiscount, OrderPayment } from '../types';

const PAYMENT_MODES: OrderPayment['mode'][] = ['CASH', 'UPI', 'CARD', 'OTHER'];

export function BillPanel({ order }: { order: Order }) {
  const router = useRouter();
  const subtotal = orderTotal(order.items);
  const discount = discountAmount(subtotal, order.discount);
  const tax = taxAmount(subtotal, order.discount, order.taxRatePercent);
  const total = grandTotal(order.items, order.discount, order.taxRatePercent);
  const paid = amountPaid(order.payments);
  const balance = total - paid;

  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : '');
  const [mode, setMode] = useState<OrderPayment['mode']>('CASH');
  const [discountType, setDiscountType] = useState<
    NonNullable<OrderDiscount>['type']
  >(order.discount?.type ?? 'FLAT');
  const [discountValue, setDiscountValue] = useState(
    order.discount ? String(order.discount.value) : '',
  );
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const noPaymentsYet = order.payments.length === 0;

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

  async function handleApplyDiscount(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const value = Number(discountValue);
    const result = await applyDiscount({
      orderId: order.id,
      discount: value > 0 ? { type: discountType, value } : null,
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
      <div className="flex flex-col gap-1 text-sm">
        <p className="flex justify-between">
          <span className="text-[var(--muted)]">Subtotal</span>
          <span>{subtotal.toFixed(2)}</span>
        </p>
        {discount > 0 && (
          <p className="flex justify-between text-[var(--color-success-600)]">
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
          <p className="flex justify-between text-[var(--muted)]">
            <span>Tax ({order.taxRatePercent}%)</span>
            <span>{tax.toFixed(2)}</span>
          </p>
        )}
        <p className="flex justify-between font-bold">
          <span>Total</span>
          <span>{total.toFixed(2)}</span>
        </p>
        <p className="mt-1 flex justify-between text-[var(--muted)]">
          <span>Paid so far</span>
          <span>{paid.toFixed(2)}</span>
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

      {/* Discount is a one-time, pre-payment decision — changing it after
          money has already been collected against the old total would
          leave the recorded payments inconsistent with the new balance. */}
      {noPaymentsYet && (
        <form
          onSubmit={handleApplyDiscount}
          className="flex flex-wrap items-end gap-2 border-b border-[var(--border)] pb-4"
        >
          <select
            value={discountType}
            onChange={(event) =>
              setDiscountType(
                event.target.value as NonNullable<OrderDiscount>['type'],
              )
            }
            className="input w-auto"
          >
            <option value="FLAT">Flat ₹</option>
            <option value="PERCENT">Percent %</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Discount"
            value={discountValue}
            onChange={(event) => setDiscountValue(event.target.value)}
            className="input w-28"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn btn-secondary"
          >
            {order.discount ? 'Update discount' : 'Apply discount'}
          </button>
        </form>
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
