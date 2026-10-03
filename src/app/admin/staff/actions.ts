'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { type ActionResult, runAction } from '@/lib/action-result';
import { logAudit } from '@/lib/auth/audit';
import {
  AuthError,
  getSessionProfile,
  requireActiveTenant,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'STAFF']),
});

export async function inviteStaff(input: {
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
}): Promise<ActionResult<{ resetLink: string }>> {
  return runAction(async () => {
    const profile = requireRole(await getSessionProfile(), ['ADMIN']);
    await requireActiveTenant(profile);
    const { email, name, role } = inviteSchema.parse(input);
    // tenantId is always the inviting ADMIN's own, from the verified
    // session — never taken from the form (CLAUDE.md hard rule #2).
    const tenantId = requireTenantId(profile);

    let uid: string;
    try {
      uid = (await adminAuth.getUserByEmail(email)).uid;
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found')
        throw error;
      uid = (
        await adminAuth.createUser({
          email,
          password: crypto.randomBytes(24).toString('base64url'),
          displayName: name,
          emailVerified: false,
        })
      ).uid;
    }

    await adminAuth.setCustomUserClaims(uid, { role, tenantId });
    await adminDb
      .doc(`tenants/${tenantId}/profiles/${uid}`)
      .set({ name, role, status: 'ACTIVE' });

    // No email provider is configured for this MVP — the admin shares
    // this link with the invitee directly (chat/SMS/in person).
    const resetLink = await adminAuth.generatePasswordResetLink(email);

    await logAudit(profile, 'STAFF_INVITED', 'profile', uid, { email, role });
    revalidatePath('/admin/staff');
    return { resetLink };
  });
}

const statusSchema = z.object({
  uid: z.string().min(1),
  status: z.enum(['ACTIVE', 'DEACTIVATED']),
});

export async function setStaffStatus(input: {
  uid: string;
  status: 'ACTIVE' | 'DEACTIVATED';
}): Promise<ActionResult> {
  return runAction(async () => {
    const profile = requireRole(await getSessionProfile(), ['ADMIN']);
    await requireActiveTenant(profile);
    const { uid, status } = statusSchema.parse(input);
    const tenantId = requireTenantId(profile);

    if (uid === profile.uid) {
      throw new AuthError("You cannot change your own account's status", 403);
    }

    const ref = adminDb.doc(`tenants/${tenantId}/profiles/${uid}`);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error('No such staff member in this tenant');
    }

    await ref.update({ status });
    if (status === 'DEACTIVATED') {
      // Without this, a deactivated account's existing session cookie
      // (up to SESSION_COOKIE_MAX_AGE_MS old) would keep working until
      // it naturally expires — getSessionProfile() only decodes the
      // cookie's claims, it doesn't re-check the Firestore profile's
      // status on every request. Revoking refresh tokens makes
      // verifySessionCookie(..., true)'s checkRevoked fail on the
      // account's next request (see docs/session-settings-review.md
      // for a timing characteristic worth knowing: the check compares
      // integer-second JWT timestamps, so it needs roughly a second of
      // real gap since login to register — never an issue for a real
      // admin, who can't click this within the same second as the
      // target's login).
      await adminAuth.revokeRefreshTokens(uid);
    }
    await logAudit(
      profile,
      status === 'ACTIVE' ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
      'profile',
      uid,
      {},
    );
    revalidatePath('/admin/staff');
  });
}
