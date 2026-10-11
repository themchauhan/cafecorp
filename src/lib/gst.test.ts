import { describe, expect, it } from 'vitest';
import {
  financialYearKeyForDate,
  formatGstInvoiceNumber,
  gstSplit,
  isValidGstin,
} from './gst';

describe('financialYearKeyForDate', () => {
  it('is still the previous FY on March 31', () => {
    expect(financialYearKeyForDate(new Date('2026-03-31T23:59:00Z'))).toBe(
      '2025-26',
    );
  });

  it('rolls over to the new FY on April 1', () => {
    expect(financialYearKeyForDate(new Date('2026-04-01T00:00:00Z'))).toBe(
      '2026-27',
    );
  });

  it('stays within the same FY mid-year', () => {
    expect(financialYearKeyForDate(new Date('2026-10-11T12:00:00Z'))).toBe(
      '2026-27',
    );
  });
});

describe('isValidGstin', () => {
  it('accepts a correctly-shaped GSTIN', () => {
    expect(isValidGstin('09AAACH7409R1ZZ')).toBe(true);
  });

  it('rejects a wrong-length value', () => {
    expect(isValidGstin('09AAACH7409R1Z')).toBe(false);
  });

  it('rejects a value missing the mandatory "Z"', () => {
    expect(isValidGstin('09AAACH7409R1XZ'.slice(0, 15))).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isValidGstin('09aaach7409r1zz')).toBe(false);
  });
});

describe('gstSplit', () => {
  it('splits tax evenly into CGST and SGST', () => {
    expect(gstSplit(10)).toEqual({ cgst: 5, sgst: 5 });
  });

  it('handles zero tax', () => {
    expect(gstSplit(0)).toEqual({ cgst: 0, sgst: 0 });
  });
});

describe('formatGstInvoiceNumber', () => {
  it('combines the financial year and sequence', () => {
    expect(formatGstInvoiceNumber('2026-27', 7)).toBe('2026-27/7');
  });
});
