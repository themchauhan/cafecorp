import { describe, expect, it } from 'vitest';
import {
  discountAmount,
  grandTotal,
  orderTotal,
  taxAmount,
  taxableAmount,
} from './money';
import type { OrderLineItem } from './types';

const items: OrderLineItem[] = [
  {
    menuItemId: 'm1',
    name: 'Samosa',
    quantity: 2,
    priceSnapshot: 15,
    notes: '',
  },
];
// subtotal = 30

describe('discountAmount', () => {
  it('is 0 with no discount', () => {
    expect(discountAmount(30, null)).toBe(0);
  });

  it('applies a flat discount', () => {
    expect(discountAmount(30, { type: 'FLAT', value: 10 })).toBe(10);
  });

  it('applies a percent discount', () => {
    expect(discountAmount(30, { type: 'PERCENT', value: 10 })).toBe(3);
  });

  it('never exceeds the subtotal, even if the flat value is larger', () => {
    expect(discountAmount(30, { type: 'FLAT', value: 100 })).toBe(30);
  });

  it('never goes negative for a stray negative value', () => {
    expect(discountAmount(30, { type: 'FLAT', value: -5 })).toBe(0);
  });
});

describe('taxableAmount', () => {
  it('equals the subtotal with no discount', () => {
    expect(taxableAmount(30, null)).toBe(30);
  });

  it('is the subtotal minus the discount', () => {
    expect(taxableAmount(30, { type: 'FLAT', value: 10 })).toBe(20);
  });
});

describe('taxAmount', () => {
  it('is 0 at a 0% rate', () => {
    expect(taxAmount(30, null, 0)).toBe(0);
  });

  it('is charged on the post-discount amount, not the raw subtotal', () => {
    // subtotal 30, 10 flat discount -> taxable 20, 5% tax -> 1
    expect(taxAmount(30, { type: 'FLAT', value: 10 }, 5)).toBe(1);
  });
});

describe('grandTotal', () => {
  it('equals the subtotal with no discount and no tax', () => {
    expect(grandTotal(items, null, 0)).toBe(orderTotal(items));
  });

  it('subtracts discount and adds tax on the discounted amount', () => {
    // subtotal 30, 10 flat discount -> 20, 5% tax -> 1 -> 21
    expect(grandTotal(items, { type: 'FLAT', value: 10 }, 5)).toBe(21);
  });
});
