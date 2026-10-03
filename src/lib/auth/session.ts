import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { isTenantCurrentlyActive, type TenantData } from '@/lib/tenant';
import type { Role, SessionProfile } from './types';

export const SESSION_COOKIE_NAME = '__session';
const SESSION_COOKIE_DAYS = 5;
export const SESSION_COOKIE_MAX_AGE_MS =
  SESSION_COOKIE_DAYS * 24 * 60 * 60 * 1000;

const ROLES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];

function isRole(value: unknown): value is Role {
  return (
    typeof value === 'string' && (ROLES as readonly string[]).includes(value)
  );
}

/**
 * Exchanges a verified Firebase ID token for a session cookie. The
 * caller must have already verified the ID token (see the /api/session
 * route) — this does not re-verify it.
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_MAX_AGE_MS,
  });
}

/**
 * The ONLY place `tenantId`/`role` are read from (CLAUDE.md hard rule
 * #2) — decoded from the verified session cookie's custom claims,
 * never from a request body or client-supplied field.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (!isRole(decoded.role)) return null;
    const tenantId =
      typeof decoded.tenantId === 'string' ? decoded.tenantId : null;
    return { uid: decoded.uid, role: decoded.role, tenantId };
  } catch {
    return null; // expired, revoked, or malformed cookie
  }
}

export class AuthError extends Error {
  readonly status: 401 | 403;
  constructor(message: string, status: 401 | 403 = 403) {
    super(message);
    this.status = status;
  }
}

/** Throws if not signed in or not one of `roles`. Returns the profile for convenience. */
export function requireRole(
  profile: SessionProfile | null,
  roles: readonly Role[],
): SessionProfile {
  if (!profile) throw new AuthError('Not signed in', 401);
  if (!roles.includes(profile.role)) {
    throw new AuthError(`Requires role: ${roles.join(', ')}`, 403);
  }
  return profile;
}

/** Narrows `tenantId` to a string, throwing for the SUPER_ADMIN (no-tenant) case. */
export function requireTenantId(profile: SessionProfile): string {
  if (!profile.tenantId) throw new AuthError('No tenant on this account', 403);
  return profile.tenantId;
}

/**
 * Throws unless the profile's tenant is ACTIVE *and* not past its
 * trial/subscription expiry (see isTenantCurrentlyActive — this is
 * the server-side enforcement Phase 7 requires even if a client tries
 * to bypass an expired/suspended state). SUPER_ADMIN is exempt (not
 * tenant-scoped). Reads via the Admin SDK, bypassing Security Rules,
 * since this only ever runs in a trusted server context.
 */
export async function requireActiveTenant(
  profile: SessionProfile,
): Promise<void> {
  if (profile.role === 'SUPER_ADMIN') return;
  if (!profile.tenantId) throw new AuthError('No tenant on this account', 403);

  const snap = await adminDb.doc(`tenants/${profile.tenantId}`).get();
  if (!snap.exists || !isTenantCurrentlyActive(snap.data() as TenantData)) {
    throw new AuthError('This tenant is not active', 403);
  }
}
