'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { CheckBadgeIcon, FlameBadgeIcon } from '@/components/icons';
import { markOrderReady } from '../orders/actions';
import type { Order } from '../orders/types';
import { formatElapsed, ticketUrgency, type TicketUrgency } from './timer';

type LiveOrder = Order;

const URGENCY_BORDER: Record<TicketUrgency, string> = {
  normal: 'border-t-[var(--color-warning-600)]',
  warning: 'border-t-[var(--color-danger-600)]',
  urgent: 'border-t-[var(--color-danger-600)] animate-pulse',
};

const URGENCY_BADGE: Record<TicketUrgency, string> = {
  normal: 'badge-kot',
  warning: 'badge-timer-warning',
  urgent: 'badge-timer-urgent',
};

function TicketCard({
  order,
  now,
  action,
}: {
  order: LiveOrder;
  now: number;
  action?: { label: string; pending: boolean; onClick: () => void };
}) {
  const elapsedMs = order.kotSentAt
    ? now - new Date(order.kotSentAt).getTime()
    : 0;
  const urgency = ticketUrgency(elapsedMs);
  const isCooking = order.status === 'KOT_SENT';

  return (
    <div
      className={`card flex flex-col gap-3 border-t-4 p-4 ${
        isCooking
          ? URGENCY_BORDER[urgency]
          : 'border-t-[var(--color-success-600)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-[var(--color-brand-50)] px-2 text-sm font-extrabold text-[var(--color-brand-700)]">
          #{order.ticketNumber || order.id.slice(0, 4)}
        </span>
        <p className="flex-1 text-lg font-bold">
          {order.orderType.replace('_', '-')}
          {order.tableId ? ` · Table ${order.tableId}` : ''}
        </p>
        {isCooking && (
          <span className={`badge ${URGENCY_BADGE[urgency]}`}>
            {order.kotSentAt ? formatElapsed(elapsedMs) : ''}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-2 text-base">
        {order.items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="font-bold text-[var(--color-brand-600)]">
              {item.quantity}&times;
            </span>
            <span>
              {item.name}
              {item.notes ? (
                <span className="text-[var(--muted)]"> ({item.notes})</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.pending}
          className="btn btn-primary mt-1"
        >
          {action.pending ? 'Marking ready…' : action.label}
        </button>
      )}
      {!isCooking && (
        <Link href={`/orders/${order.id}`} className="btn btn-secondary">
          Bill this order
        </Link>
      )}
    </div>
  );
}

/**
 * No orderBy in the query (only an equality filter, via 'in' on
 * status) so this never needs a composite Firestore index deployed —
 * sorts client-side instead. See docs/phases/phase-3.md.
 */
export function KitchenBoard({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<LiveOrder[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, `tenants/${tenantId}/orders`),
      where('status', 'in', ['KOT_SENT', 'SERVED']),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const next = snapshot.docs.map((doc) => {
        const data = doc.data();
        const kotSentAt = data.kotSentAt as Timestamp | undefined;
        return {
          id: doc.id,
          ticketNumber: data.ticketNumber ?? 0,
          orderType: data.orderType,
          tableId: data.tableId ?? null,
          status: data.status,
          items: data.items ?? [],
          payments: data.payments ?? [],
          cancelReason: data.cancelReason ?? null,
          createdBy: data.createdBy,
          createdAt: null,
          kotSentAt: kotSentAt ? kotSentAt.toDate().toISOString() : null,
          servedAt: null,
          taxRatePercent: data.taxRatePercent ?? 0,
          discount: data.discount ?? null,
        } as LiveOrder;
      });
      next.sort((a, b) => (a.kotSentAt ?? '').localeCompare(b.kotSentAt ?? ''));
      setOrders(next);
    });
    return unsubscribe;
  }, [tenantId]);

  if (orders === null) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const cooking = orders.filter((order) => order.status === 'KOT_SENT');
  const ready = orders.filter((order) => order.status === 'SERVED');
  const oldestCookingMs = cooking.reduce((oldest, order) => {
    if (!order.kotSentAt) return oldest;
    const elapsed = now - new Date(order.kotSentAt).getTime();
    return Math.max(oldest, elapsed);
  }, 0);

  function handleMarkReady(orderId: string) {
    setError(null);
    setPendingId(orderId);
    startTransition(async () => {
      const result = await markOrderReady(orderId);
      if (!result.ok) setError(result.error);
      setPendingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm font-semibold">
        <span className="flex items-center gap-2 text-[var(--color-warning-700)]">
          <FlameBadgeIcon />
          {cooking.length} cooking
          {cooking.length > 0 && ` · oldest ${formatElapsed(oldestCookingMs)}`}
        </span>
        <span className="flex items-center gap-2 text-[var(--color-success-700)]">
          <CheckBadgeIcon />
          {ready.length} ready to serve
        </span>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
      )}

      {orders.length === 0 ? (
        <p className="card p-6 text-sm text-[var(--muted)]">
          No tickets in the kitchen right now.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <FlameBadgeIcon size={20} /> Cooking
            </h2>
            {cooking.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Nothing cooking right now.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cooking.map((order) => (
                  <TicketCard
                    key={order.id}
                    order={order}
                    now={now}
                    action={{
                      label: 'Mark ready',
                      pending: isPending && pendingId === order.id,
                      onClick: () => handleMarkReady(order.id),
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {ready.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <CheckBadgeIcon size={20} /> Ready to serve
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ready.map((order) => (
                  <TicketCard key={order.id} order={order} now={now} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
