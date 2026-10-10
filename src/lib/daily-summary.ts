/**
 * Phase 6 reports read these docs instead of aggregating raw orders —
 * see CLAUDE.md's tech-stack note. Written only by the billing Server
 * Action (src/app/orders/billing-actions.ts), in the same transaction
 * as the order write that produced them.
 */
export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'OTHER';

export type DailySummary = {
  date: string; // YYYY-MM-DD, UTC
  totalsByMode: Partial<Record<PaymentMode, number>>;
  totalsByStaff: Record<string, number>;
  itemsSold: Record<string, number>; // menuItemId -> quantity
  categorySales: Record<string, number>; // categoryId -> revenue
  // "0".."23", UTC — number of orders billed in that hour. Phase 9's
  // peak-hours report.
  ordersByHour: Record<string, number>;
};

/** UTC date key. Single-timezone assumption for the MVP — see docs/phases/phase-4.md. */
export function dateKeyForDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC hour-of-day key, "0".."23" — same single-timezone assumption as dateKeyForDate. */
export function hourKeyForDate(date: Date): string {
  return String(date.getUTCHours());
}

export function dailySummaryDocPath(tenantId: string, dateKey: string): string {
  return `tenants/${tenantId}/dailySummaries/${dateKey}`;
}
