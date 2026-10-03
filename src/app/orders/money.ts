// Pure helpers, safe to import from client or server code (no
// "server-only" guard) — used by the order builder, the bill panel,
// the receipt page, and the billing Server Action alike.
import type { Order } from './types';

export function orderTotal(items: Order['items']): number {
  return items.reduce(
    (sum, item) => sum + item.priceSnapshot * item.quantity,
    0,
  );
}

export function amountPaid(payments: Order['payments']): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}
