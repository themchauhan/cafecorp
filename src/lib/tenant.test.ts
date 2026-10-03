import { describe, expect, it } from 'vitest';
import { isTenantCurrentlyActive } from './tenant';

const NOW = new Date('2026-06-15T00:00:00.000Z');
const PAST = '2026-01-01T00:00:00.000Z';
const FUTURE = '2026-12-01T00:00:00.000Z';

describe('isTenantCurrentlyActive', () => {
  it('is false when status is SUSPENDED, regardless of dates', () => {
    expect(
      isTenantCurrentlyActive(
        { status: 'SUSPENDED', plan: 'PAID', subscriptionEndsAt: FUTURE },
        NOW,
      ),
    ).toBe(false);
  });

  it('is true when ACTIVE with no expiry field set', () => {
    expect(
      isTenantCurrentlyActive({ status: 'ACTIVE', plan: 'PAID' }, NOW),
    ).toBe(true);
  });

  it('checks trialEndsAt for a TRIAL plan, not subscriptionEndsAt', () => {
    expect(
      isTenantCurrentlyActive(
        {
          status: 'ACTIVE',
          plan: 'TRIAL',
          trialEndsAt: PAST,
          subscriptionEndsAt: FUTURE, // irrelevant for a TRIAL plan
        },
        NOW,
      ),
    ).toBe(false);
  });

  it('checks subscriptionEndsAt for a non-TRIAL plan, not trialEndsAt', () => {
    expect(
      isTenantCurrentlyActive(
        {
          status: 'ACTIVE',
          plan: 'PAID',
          trialEndsAt: PAST, // irrelevant once on a paid plan
          subscriptionEndsAt: FUTURE,
        },
        NOW,
      ),
    ).toBe(true);
  });

  it('is false once the relevant expiry date has passed', () => {
    expect(
      isTenantCurrentlyActive(
        { status: 'ACTIVE', plan: 'PAID', subscriptionEndsAt: PAST },
        NOW,
      ),
    ).toBe(false);
  });

  it('is true right up to (exclusive of) the expiry instant', () => {
    const justAfter = new Date(NOW.getTime() + 1).toISOString();
    expect(
      isTenantCurrentlyActive(
        { status: 'ACTIVE', plan: 'PAID', subscriptionEndsAt: justAfter },
        NOW,
      ),
    ).toBe(true);
  });
});
