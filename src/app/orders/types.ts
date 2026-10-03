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

export type Order = {
  id: string;
  orderType: OrderType;
  tableId: string | null;
  status: OrderStatus;
  items: OrderLineItem[];
  payments: OrderPayment[];
  cancelReason: string | null;
  createdBy: string;
  createdAt: string | null;
  kotSentAt: string | null;
};
