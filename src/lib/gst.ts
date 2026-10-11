/**
 * India GST tax-invoice helpers (Phase 9+). Pure logic, no Firestore
 * access — mirrors src/lib/daily-summary.ts's style. Regular GST
 * scheme only (see docs/plan): a real Tax Invoice with GSTIN, a
 * financial-year-unique serial number, and a CGST+SGST breakup
 * (Rule 46, CGST Rules 2017) — not the Composition-scheme Bill of
 * Supply variant.
 */

// Restaurant/cafe/eating-facility services — the single SAC code that
// covers a cafe's whole bill, unlike a retail/pharmacy tool which
// needs per-item HSN codes for physical goods.
export const DEFAULT_SAC_CODE = '996331';

// Format only (2-digit state code + 10-char PAN + entity code + 'Z' +
// checksum) — not a full checksum validation, which needs the actual
// GSTIN checksum algorithm and isn't worth the complexity here.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidGstin(value: string): boolean {
  return GSTIN_PATTERN.test(value);
}

/** Indian financial year (April 1 - March 31), e.g. "2026-27". UTC, same single-timezone assumption as dateKeyForDate. */
export function financialYearKeyForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function gstSplit(taxAmount: number): { cgst: number; sgst: number } {
  return { cgst: taxAmount / 2, sgst: taxAmount / 2 };
}

export function formatGstInvoiceNumber(
  financialYear: string,
  sequence: number,
): string {
  return `${financialYear}/${sequence}`;
}
