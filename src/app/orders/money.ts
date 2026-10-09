// Pure helpers, safe to import from client or server code (no
// "server-only" guard) — used by the order builder, the bill panel,
// the receipt page, and the billing Server Action alike.
import type { Order, OrderDiscount } from './types';

export function orderTotal(items: Order['items']): number {
  return items.reduce(
    (sum, item) => sum + item.priceSnapshot * item.quantity,
    0,
  );
}

export function amountPaid(payments: Order['payments']): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

/** Never more than the subtotal itself, even for a stray >100% flat/percent entry. */
export function discountAmount(
  subtotal: number,
  discount: OrderDiscount,
): number {
  if (!discount) return 0;
  const raw =
    discount.type === 'PERCENT'
      ? subtotal * (discount.value / 100)
      : discount.value;
  return Math.min(Math.max(raw, 0), subtotal);
}

/** Tax is charged on the post-discount amount, not the raw subtotal. */
export function taxableAmount(
  subtotal: number,
  discount: OrderDiscount,
): number {
  return subtotal - discountAmount(subtotal, discount);
}

export function taxAmount(
  subtotal: number,
  discount: OrderDiscount,
  taxRatePercent: number,
): number {
  return taxableAmount(subtotal, discount) * (taxRatePercent / 100);
}

export function grandTotal(
  items: Order['items'],
  discount: OrderDiscount,
  taxRatePercent: number,
): number {
  const subtotal = orderTotal(items);
  return (
    taxableAmount(subtotal, discount) +
    taxAmount(subtotal, discount, taxRatePercent)
  );
}
