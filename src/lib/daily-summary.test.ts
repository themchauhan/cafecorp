import { describe, expect, it } from 'vitest';
import { dateKeyForDate, hourKeyForDate } from './daily-summary';

describe('dateKeyForDate', () => {
  it('formats as YYYY-MM-DD in UTC', () => {
    expect(dateKeyForDate(new Date('2026-10-05T18:30:00Z'))).toBe('2026-10-05');
  });
});

describe('hourKeyForDate', () => {
  it('formats the UTC hour as a plain number string', () => {
    expect(hourKeyForDate(new Date('2026-10-05T00:00:00Z'))).toBe('0');
    expect(hourKeyForDate(new Date('2026-10-05T09:15:00Z'))).toBe('9');
    expect(hourKeyForDate(new Date('2026-10-05T23:59:00Z'))).toBe('23');
  });
});
