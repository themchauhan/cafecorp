import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { SessionProfile } from './types';

// Firestore rejects `undefined` anywhere in a document, and callers
// often pass an optional field straight through (e.g. a tableId that
// doesn't apply to this order type) — drop those keys instead of
// letting every call site have to remember to do it.
function cleanMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}

/** Append-only audit trail for a tenant-scoped action (ADMIN/STAFF). */
export async function logAudit(
  profile: SessionProfile,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!profile.tenantId) return;
  await adminDb.collection(`tenants/${profile.tenantId}/auditLogs`).add({
    userId: profile.uid,
    action,
    targetType,
    targetId,
    metadata: cleanMetadata(metadata),
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Append-only audit trail for a SUPER_ADMIN action that affects a
 * specific tenant (create/suspend/reactivate, plan change, expiry
 * change, subscription payment — Phase 7). Written into the *affected*
 * tenant's own auditLogs, not the super admin's (who has none), so the
 * tenant owner can see why their account's state changed.
 */
export async function logPlatformAudit(
  profile: SessionProfile,
  action: string,
  affectedTenantId: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await adminDb.collection(`tenants/${affectedTenantId}/auditLogs`).add({
    userId: profile.uid,
    action,
    targetType,
    targetId,
    metadata: cleanMetadata(metadata),
    createdAt: FieldValue.serverTimestamp(),
  });
}
