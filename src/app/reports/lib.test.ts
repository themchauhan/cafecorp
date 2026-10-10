import { describe, expect, it } from 'vitest';
import { aggregateSummaries } from './lib';
import type { DailySummary } from '@/lib/daily-summary';

function summary(overrides: Partial<DailySummary>): DailySummary {
  return {
    date: '2026-10-01',
    totalsByMode: {},
    totalsByStaff: {},
    itemsSold: {},
    categorySales: {},
    ordersByHour: {},
    ...overrides,
  };
}

describe('aggregateSummaries', () => {
  it('returns all-zero shape for an empty range', () => {
    const result = aggregateSummaries([]);
    expect(result).toEqual({
      totalsByMode: {},
      totalsByStaff: {},
      itemsSold: {},
      categorySales: {},
      ordersByHour: {},
      grandTotal: 0,
    });
  });

  it('sums ordersByHour across days, merging the same hour key', () => {
    const result = aggregateSummaries([
      summary({ ordersByHour: { '9': 2, '13': 1 } }),
      summary({ date: '2026-10-02', ordersByHour: { '9': 1, '18': 3 } }),
    ]);
    expect(result.ordersByHour).toEqual({ '9': 3, '13': 1, '18': 3 });
  });

  it('sums a single day correctly', () => {
    const result = aggregateSummaries([
      summary({
        totalsByMode: { CASH: 100, UPI: 50 },
        totalsByStaff: { 'staff-1': 150 },
        itemsSold: { 'item-1': 3 },
        categorySales: { 'cat-1': 150 },
      }),
    ]);
    expect(result.totalsByMode).toEqual({ CASH: 100, UPI: 50 });
    expect(result.grandTotal).toBe(150);
  });

  it('sums across multiple days, merging the same keys', () => {
    const result = aggregateSummaries([
      summary({
        totalsByMode: { CASH: 100 },
        totalsByStaff: { 'staff-1': 100 },
        itemsSold: { 'item-1': 2 },
        categorySales: { 'cat-1': 100 },
      }),
      summary({
        date: '2026-10-02',
        totalsByMode: { CASH: 50, UPI: 25 },
        totalsByStaff: { 'staff-1': 50, 'staff-2': 25 },
        itemsSold: { 'item-1': 1, 'item-2': 4 },
        categorySales: { 'cat-1': 50, 'cat-2': 25 },
      }),
    ]);

    expect(result.totalsByMode).toEqual({ CASH: 150, UPI: 25 });
    expect(result.totalsByStaff).toEqual({ 'staff-1': 150, 'staff-2': 25 });
    expect(result.itemsSold).toEqual({ 'item-1': 3, 'item-2': 4 });
    expect(result.categorySales).toEqual({ 'cat-1': 150, 'cat-2': 25 });
    expect(result.grandTotal).toBe(175);
  });

  it('tolerates a summary doc missing some fields', () => {
    const result = aggregateSummaries([
      summary({ totalsByMode: { CASH: 20 } }),
    ]);
    expect(result.totalsByStaff).toEqual({});
    expect(result.itemsSold).toEqual({});
    expect(result.grandTotal).toBe(20);
  });
});
