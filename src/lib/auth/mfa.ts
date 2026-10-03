import 'server-only';
import { generateSecret, generateURI, verify } from 'otplib';
import { adminDb } from '@/lib/firebase/admin';
import type { SessionProfile } from './types';

/**
 * Custom TOTP MFA (not Firebase's native MFA, which needs Identity
 * Platform — CLAUDE.md hard rule #10). The secret lives at a path
 * Security Rules always deny client access to; only the Admin SDK
 * ever reads or writes it.
 */
function mfaDocPath(profile: Pick<SessionProfile, 'tenantId' | 'uid'>): string {
  return profile.tenantId
    ? `tenants/${profile.tenantId}/profiles/${profile.uid}/private/mfa`
    : `platformAdmins/${profile.uid}/private/mfa`; // SUPER_ADMIN
}

type MfaRecord = {
  secret: string;
  enabled: boolean;
};

export async function getMfaRecord(
  profile: Pick<SessionProfile, 'tenantId' | 'uid'>,
): Promise<MfaRecord | null> {
  const snap = await adminDb.doc(mfaDocPath(profile)).get();
  if (!snap.exists) return null;
  return snap.data() as MfaRecord;
}

export async function isMfaEnabled(
  profile: Pick<SessionProfile, 'tenantId' | 'uid'>,
): Promise<boolean> {
  const record = await getMfaRecord(profile);
  return record?.enabled === true;
}

/** Starts enrollment: generates and stores a new, not-yet-enabled secret. */
export async function startMfaEnrollment(
  profile: Pick<SessionProfile, 'tenantId' | 'uid'>,
  accountLabel: string,
): Promise<{ secret: string; otpauthUrl: string }> {
  const secret = generateSecret();
  await adminDb.doc(mfaDocPath(profile)).set({ secret, enabled: false });
  const otpauthUrl = generateURI({
    issuer: 'CafeCorp',
    label: accountLabel,
    secret,
  });
  return { secret, otpauthUrl };
}

/** Verifies a code against the stored secret. Does not change `enabled`. */
export async function verifyMfaToken(
  profile: Pick<SessionProfile, 'tenantId' | 'uid'>,
  token: string,
): Promise<boolean> {
  const record = await getMfaRecord(profile);
  if (!record) return false;
  const result = await verify({ token, secret: record.secret });
  return result.valid;
}

/** Call after the first successful verifyMfaToken() to turn enrollment on. */
export async function enableMfa(
  profile: Pick<SessionProfile, 'tenantId' | 'uid'>,
): Promise<void> {
  await adminDb
    .doc(mfaDocPath(profile))
    .set({ enabled: true }, { merge: true });
}

export async function disableMfa(
  profile: Pick<SessionProfile, 'tenantId' | 'uid'>,
): Promise<void> {
  await adminDb.doc(mfaDocPath(profile)).delete();
}
