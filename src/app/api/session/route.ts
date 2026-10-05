import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { isMfaEnabled, verifyMfaToken } from '@/lib/auth/mfa';
import {
  createSessionCookie,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';

const bodySchema = z.object({
  idToken: z.string().min(1),
  totpCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(parsed.data.idToken);
  } catch (err) {
    console.error('DEBUG verifyIdToken failed', {
      message: err instanceof Error ? err.message : err,
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS:
        process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
      FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
    });
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const role = decoded.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'STAFF') {
    return NextResponse.json(
      { error: 'This account has no role assigned yet' },
      { status: 403 },
    );
  }

  const tenantId =
    typeof decoded.tenantId === 'string' ? decoded.tenantId : null;

  if (role !== 'SUPER_ADMIN') {
    if (!tenantId) {
      return NextResponse.json(
        { error: 'This account has no tenant assigned' },
        { status: 403 },
      );
    }
    const profileSnap = await adminDb
      .doc(`tenants/${tenantId}/profiles/${decoded.uid}`)
      .get();
    if (!profileSnap.exists || profileSnap.get('status') !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This account is deactivated' },
        { status: 403 },
      );
    }
  }

  // Custom TOTP MFA (CLAUDE.md hard rule #10), required once an
  // ADMIN/SUPER_ADMIN has enrolled — see src/lib/auth/mfa.ts.
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    const mfaProfile = { uid: decoded.uid, tenantId };
    if (await isMfaEnabled(mfaProfile)) {
      if (!parsed.data.totpCode) {
        return NextResponse.json({ error: 'MFA_REQUIRED' }, { status: 401 });
      }
      if (!(await verifyMfaToken(mfaProfile, parsed.data.totpCode))) {
        return NextResponse.json(
          { error: 'Invalid authentication code' },
          { status: 401 },
        );
      }
    }
  }

  const sessionCookie = await createSessionCookie(parsed.data.idToken);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const existing = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (existing) {
    try {
      const decoded = await adminAuth.verifySessionCookie(existing);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}
