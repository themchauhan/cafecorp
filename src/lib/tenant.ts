// Pure, no Firestore access — shared by requireActiveTenant() (server
// enforcement) and the super-admin UI (computed status display), so
// the two can never disagree about what "active" means.
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export type TenantData = {
  status: TenantStatus;
  plan: string;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
};

/**
 * True if a tenant is usable right now: SUPER_ADMIN manually set it to
 * ACTIVE, *and* the plan's relevant expiry date (trialEndsAt for
 * TRIAL, subscriptionEndsAt otherwise) hasn't passed, if one is set.
 */
export function isTenantCurrentlyActive(
  tenant: TenantData,
  now: Date = new Date(),
): boolean {
  if (tenant.status !== 'ACTIVE') return false;
  const expiry =
    tenant.plan === 'TRIAL' ? tenant.trialEndsAt : tenant.subscriptionEndsAt;
  if (!expiry) return true;
  return new Date(expiry) > now;
}
