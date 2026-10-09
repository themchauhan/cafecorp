import { describe, expect, it } from 'vitest';
import {
  formatElapsed,
  ticketUrgency,
  WARNING_THRESHOLD_MINUTES,
  URGENT_THRESHOLD_MINUTES,
} from './timer';

describe('formatElapsed', () => {
  it('formats seconds as m:ss', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(5_000)).toBe('0:05');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(600_000)).toBe('10:00');
  });

  it('never goes negative (clock skew between client and server)', () => {
    expect(formatElapsed(-5_000)).toBe('0:00');
  });
});

describe('ticketUrgency', () => {
  it('is normal before the warning threshold', () => {
    expect(ticketUrgency(0)).toBe('normal');
    expect(ticketUrgency((WARNING_THRESHOLD_MINUTES - 0.1) * 60_000)).toBe(
      'normal',
    );
  });

  it('is warning at and after the warning threshold, before urgent', () => {
    expect(ticketUrgency(WARNING_THRESHOLD_MINUTES * 60_000)).toBe('warning');
    expect(ticketUrgency((URGENT_THRESHOLD_MINUTES - 0.1) * 60_000)).toBe(
      'warning',
    );
  });

  it('is urgent at and after the urgent threshold', () => {
    expect(ticketUrgency(URGENT_THRESHOLD_MINUTES * 60_000)).toBe('urgent');
    expect(ticketUrgency(URGENT_THRESHOLD_MINUTES * 60_000 * 10)).toBe(
      'urgent',
    );
  });
});
