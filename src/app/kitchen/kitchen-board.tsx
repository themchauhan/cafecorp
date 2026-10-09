'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
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

/**
 * No orderBy in the query (only an equality filter) so this never
 * needs a composite Firestore index deployed — sorts client-side
 * instead. See docs/phases/phase-3.md.
 */
export function KitchenBoard({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<LiveOrder[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, `tenants/${tenantId}/orders`),
      where('status', '==', 'KOT_SENT'),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const next = snapshot.docs.map((doc) => {
        const data = doc.data();
        const kotSentAt = data.kotSentAt as Timestamp | undefined;
        return {
          id: doc.id,
          orderType: data.orderType,
          tableId: data.tableId ?? null,
          status: data.status,
          items: data.items ?? [],
          payments: data.payments ?? [],
          cancelReason: data.cancelReason ?? null,
          createdBy: data.createdBy,
          createdAt: null,
          kotSentAt: kotSentAt ? kotSentAt.toDate().toISOString() : null,
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

  if (orders.length === 0) {
    return (
      <p className="card p-6 text-sm text-[var(--muted)]">
        No tickets in the kitchen right now.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((order) => {
        const elapsedMs = order.kotSentAt
          ? now - new Date(order.kotSentAt).getTime()
          : 0;
        const urgency = ticketUrgency(elapsedMs);
        return (
          <div
            key={order.id}
            className={`card flex flex-col gap-3 border-t-4 p-4 ${URGENCY_BORDER[urgency]}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">
                {order.orderType.replace('_', '-')}
                {order.tableId ? ` · Table ${order.tableId}` : ''}
              </p>
              <span className={`badge ${URGENCY_BADGE[urgency]}`}>
                {order.kotSentAt ? formatElapsed(elapsedMs) : ''}
              </span>
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
                      <span className="text-[var(--muted)]">
                        {' '}
                        ({item.notes})
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
