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
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>;
  }

  if (orders.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No tickets in the kitchen right now.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex flex-col gap-2 rounded border border-zinc-300 p-4 text-sm dark:border-zinc-700"
        >
          <p className="font-medium">
            {order.orderType.replace('_', '-')}
            {order.tableId ? ` · Table ${order.tableId}` : ''}
          </p>
          <p className="text-zinc-500 dark:text-zinc-400">
            {order.kotSentAt
              ? new Date(order.kotSentAt).toLocaleTimeString()
              : ''}
          </p>
          <ul className="flex flex-col gap-1">
            {order.items.map((item, index) => (
              <li key={index}>
                {item.quantity} &times; {item.name}
                {item.notes ? ` (${item.notes})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
