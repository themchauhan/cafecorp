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

type LiveOrder = Order;

/**
 * No orderBy in the query (only an equality filter) so this never
 * needs a composite Firestore index deployed — sorts client-side
 * instead. See docs/phases/phase-3.md.
 */
export function KitchenBoard({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<LiveOrder[] | null>(null);

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
      {orders.map((order) => (
        <div
          key={order.id}
          className="card flex flex-col gap-3 border-t-4 border-t-[var(--color-warning-600)] p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold">
              {order.orderType.replace('_', '-')}
              {order.tableId ? ` · Table ${order.tableId}` : ''}
            </p>
            <span className="badge badge-kot">
              {order.kotSentAt
                ? new Date(order.kotSentAt).toLocaleTimeString()
                : ''}
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
                    <span className="text-[var(--muted)]"> ({item.notes})</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
