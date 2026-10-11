import 'server-only';
import type { Timestamp } from 'firebase-admin/firestore';
import type { Order } from './types';

type RawOrderDoc = Omit<
  Order,
  | 'id'
  | 'createdAt'
  | 'kotSentAt'
  | 'servedAt'
  | 'taxRatePercent'
  | 'discount'
  | 'ticketNumber'
  | 'gstEnabled'
  | 'gstin'
  | 'gstLegalName'
  | 'gstAddress'
  | 'gstSacCode'
  | 'gstInvoiceNumber'
> & {
  createdAt?: Timestamp;
  kotSentAt?: Timestamp;
  servedAt?: Timestamp;
  // Absent on any order created before Phase 9.
  taxRatePercent?: number;
  discount?: Order['discount'];
  // Absent on any order created before this ticket-numbering change.
  ticketNumber?: number;
  // Absent on any order created before GST invoicing existed.
  gstEnabled?: boolean;
  gstin?: string | null;
  gstLegalName?: string | null;
  gstAddress?: string | null;
  gstSacCode?: string | null;
  gstInvoiceNumber?: string | null;
};

/** Converts a Firestore order doc to a plain, serializable Order (Timestamps -> ISO strings). */
export function mapOrderDoc(id: string, data: RawOrderDoc): Order {
  return {
    id,
    // 0 is a visibly-pre-numbering placeholder, not a real ticket
    // number (those start at 1) — only ever seen on orders that
    // predate this feature.
    ticketNumber: data.ticketNumber ?? 0,
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
    servedAt: data.servedAt ? data.servedAt.toDate().toISOString() : null,
    gstEnabled: data.gstEnabled ?? false,
    gstin: data.gstin ?? null,
    gstLegalName: data.gstLegalName ?? null,
    gstAddress: data.gstAddress ?? null,
    gstSacCode: data.gstSacCode ?? null,
    gstInvoiceNumber: data.gstInvoiceNumber ?? null,
  };
}
