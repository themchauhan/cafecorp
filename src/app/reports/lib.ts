// Pure aggregation over already-fetched dailySummaries docs — no
// Firestore access here, so it's unit-testable without mocking the
// Admin SDK. The page (lib-free) does the fetching and name lookups.
import type { DailySummary } from '@/lib/daily-summary';

export type AggregatedReport = {
  totalsByMode: Record<string, number>;
  totalsByStaff: Record<string, number>;
  itemsSold: Record<string, number>;
  categorySales: Record<string, number>;
  grandTotal: number;
};

function addInto(
  target: Record<string, number>,
  source: Record<string, number> | undefined,
) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = (target[key] ?? 0) + value;
  }
}

export function aggregateSummaries(
  summaries: DailySummary[],
): AggregatedReport {
  const totalsByMode: Record<string, number> = {};
  const totalsByStaff: Record<string, number> = {};
  const itemsSold: Record<string, number> = {};
  const categorySales: Record<string, number> = {};

  for (const summary of summaries) {
    addInto(totalsByMode, summary.totalsByMode);
    addInto(totalsByStaff, summary.totalsByStaff);
    addInto(itemsSold, summary.itemsSold);
    addInto(categorySales, summary.categorySales);
  }

  const grandTotal = Object.values(totalsByMode).reduce(
    (sum, value) => sum + value,
    0,
  );

  return { totalsByMode, totalsByStaff, itemsSold, categorySales, grandTotal };
}
