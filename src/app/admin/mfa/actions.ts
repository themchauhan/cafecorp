'use server';

import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { adminAuth } from '@/lib/firebase/admin';
import { type ActionResult, runAction } from '@/lib/action-result';
import { logAudit } from '@/lib/auth/audit';
import {
  getSessionProfile,
  requireActiveTenant,
  requireRole,
} from '@/lib/auth/session';
import {
  disableMfa,
  enableMfa,
  startMfaEnrollment,
  verifyMfaToken,
} from '@/lib/auth/mfa';

const MFA_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

export async function beginMfaEnrollment(): Promise<
  ActionResult<{ qrDataUrl: string; secret: string }>
> {
  return runAction(async () => {
    const profile = requireRole(await getSessionProfile(), MFA_ROLES);
    await requireActiveTenant(profile);
    const email = await adminAuth
      .getUser(profile.uid)
      .then((user) => user.email ?? profile.uid);
    const { secret, otpauthUrl } = await startMfaEnrollment(profile, email);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { qrDataUrl, secret };
  });
}

export async function confirmMfaEnrollment(
  code: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const profile = requireRole(await getSessionProfile(), MFA_ROLES);
    await requireActiveTenant(profile);
    if (!(await verifyMfaToken(profile, code))) {
      throw new Error(
        'Invalid code — check your authenticator app and try again',
      );
    }
    await enableMfa(profile);
    await logAudit(profile, 'MFA_ENABLED', 'profile', profile.uid, {});
    revalidatePath('/admin/mfa');
  });
}

export async function turnOffMfa(): Promise<ActionResult> {
  return runAction(async () => {
    const profile = requireRole(await getSessionProfile(), MFA_ROLES);
    await requireActiveTenant(profile);
    await disableMfa(profile);
    await logAudit(profile, 'MFA_DISABLED', 'profile', profile.uid, {});
    revalidatePath('/admin/mfa');
  });
}
