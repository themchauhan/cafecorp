export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'PARCEL';

export type OrderStatus =
  'OPEN' | 'KOT_SENT' | 'SERVED' | 'BILLED' | 'CANCELLED';

export type OrderLineItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  priceSnapshot: number;
  notes: string;
};

export type OrderPayment = {
  amount: number;
  mode: 'CASH' | 'UPI' | 'CARD' | 'OTHER';
  receivedBy: string;
  receivedAt: string;
};

export type OrderDiscount = {
  type: 'FLAT' | 'PERCENT';
  value: number;
} | null;

export type Order = {
  id: string;
  // Daily, per-tenant, human-readable ticket number ("Order #7") —
  // resets each day (see dateKeyForDate in src/lib/daily-summary.ts).
  // Distinct from `id`, which is the Firestore doc id and never shown
  // to staff.
  ticketNumber: number;
  orderType: OrderType;
  tableId: string | null;
  status: OrderStatus;
  items: OrderLineItem[];
  payments: OrderPayment[];
  // Snapshotted from the tenant's configured rate when the order is
  // created — same reasoning as priceSnapshot on line items (hard
  // rule 9): a later tax-rate change must never rewrite a past
  // order's total.
  taxRatePercent: number;
  // Applied once, by staff/admin, at billing time — unlike the tax
  // rate this is a per-order decision, not a tenant-wide setting.
  discount: OrderDiscount;
  cancelReason: string | null;
  createdBy: string;
  createdAt: string | null;
  kotSentAt: string | null;
  // Set when the kitchen marks this ticket ready (KOT_SENT -> SERVED).
  servedAt: string | null;
};
