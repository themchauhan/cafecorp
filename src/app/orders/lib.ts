import 'server-only';
import type { Timestamp } from 'firebase-admin/firestore';
import type { Order } from './types';

type RawOrderDoc = Omit<
  Order,
  'id' | 'createdAt' | 'kotSentAt' | 'taxRatePercent' | 'discount'
> & {
  createdAt?: Timestamp;
  kotSentAt?: Timestamp;
  // Absent on any order created before Phase 9.
  taxRatePercent?: number;
  discount?: Order['discount'];
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
    // Orders created before Phase 9 have neither field — 0%/no
    // discount is the correct, unchanged-behavior default for them.
    taxRatePercent: data.taxRatePercent ?? 0,
    discount: data.discount ?? null,
    cancelReason: data.cancelReason ?? null,
    createdBy: data.createdBy,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    kotSentAt: data.kotSentAt ? data.kotSentAt.toDate().toISOString() : null,
  };
}
