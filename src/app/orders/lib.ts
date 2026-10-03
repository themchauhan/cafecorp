import 'server-only';
import type { Timestamp } from 'firebase-admin/firestore';
import type { Order } from './types';

type RawOrderDoc = Omit<Order, 'id' | 'createdAt' | 'kotSentAt'> & {
  createdAt?: Timestamp;
  kotSentAt?: Timestamp;
};

/** Converts a Firestore order doc to a plain, serializable Order (Timestamps -> ISO strings). */
export function mapOrderDoc(id: string, data: RawOrderDoc): Order {
  return {
    id,
    orderType: data.orderType,
    tableId: data.tableId ?? null,
    status: data.status,
    items: data.items ?? [],
    payments: data.payments ?? [],
    cancelReason: data.cancelReason ?? null,
    createdBy: data.createdBy,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    kotSentAt: data.kotSentAt ? data.kotSentAt.toDate().toISOString() : null,
  };
}
