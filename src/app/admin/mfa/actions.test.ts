import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  getUser,
  startMfaEnrollmentMock,
  verifyMfaTokenMock,
  enableMfaMock,
  disableMfaMock,
  getSessionProfileMock,
  logAuditMock,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  startMfaEnrollmentMock: vi.fn(),
  verifyMfaTokenMock: vi.fn(),
  enableMfaMock: vi.fn(),
  disableMfaMock: vi.fn(),
  getSessionProfileMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { getUser },
}));

vi.mock('@/lib/auth/mfa', () => ({
  startMfaEnrollment: startMfaEnrollmentMock,
  verifyMfaToken: verifyMfaTokenMock,
  enableMfa: enableMfaMock,
  disableMfa: disableMfaMock,
}));

vi.mock('@/lib/auth/audit', () => ({ logAudit: logAuditMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/auth/session', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/session')>(
      '@/lib/auth/session',
    );
  return {
    ...actual,
    getSessionProfile: getSessionProfileMock,
    requireActiveTenant: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  turnOffMfa,
} from './actions';

const admin = { uid: 'admin-1', role: 'ADMIN' as const, tenantId: 'tenant-a' };
const staff = { uid: 'staff-1', role: 'STAFF' as const, tenantId: 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
  getSessionProfileMock.mockResolvedValue(admin);
});

describe('beginMfaEnrollment', () => {
  it('rejects a STAFF caller', async () => {
    getSessionProfileMock.mockResolvedValue(staff);
    const result = await beginMfaEnrollment();
    expect(result.ok).toBe(false);
    expect(startMfaEnrollmentMock).not.toHaveBeenCalled();
  });

  it('returns a QR code and secret for an ADMIN caller', async () => {
    getUser.mockResolvedValue({ email: 'admin@demo.cafe' });
    startMfaEnrollmentMock.mockResolvedValue({
      secret: 'ABC123',
      otpauthUrl: 'otpauth://totp/CafeCorp:admin@demo.cafe?secret=ABC123',
    });
    const result = await beginMfaEnrollment();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.secret).toBe('ABC123');
      expect(result.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    }
  });
});

describe('confirmMfaEnrollment', () => {
  it('rejects an invalid code and does not enable MFA', async () => {
    verifyMfaTokenMock.mockResolvedValue(false);
    const result = await confirmMfaEnrollment('000000');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/invalid code/i),
    });
    expect(enableMfaMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it('enables MFA and logs an audit entry on a valid code', async () => {
    verifyMfaTokenMock.mockResolvedValue(true);
    const result = await confirmMfaEnrollment('123456');
    expect(result.ok).toBe(true);
    expect(enableMfaMock).toHaveBeenCalledWith(admin);
    expect(logAuditMock).toHaveBeenCalledWith(
      admin,
      'MFA_ENABLED',
      'profile',
      admin.uid,
      {},
    );
  });
});

describe('turnOffMfa', () => {
  it('disables MFA and logs an audit entry', async () => {
    const result = await turnOffMfa();
    expect(result.ok).toBe(true);
    expect(disableMfaMock).toHaveBeenCalledWith(admin);
    expect(logAuditMock).toHaveBeenCalledWith(
      admin,
      'MFA_DISABLED',
      'profile',
      admin.uid,
      {},
    );
  });

  it('rejects a STAFF caller', async () => {
    getSessionProfileMock.mockResolvedValue(staff);
    const result = await turnOffMfa();
    expect(result.ok).toBe(false);
    expect(disableMfaMock).not.toHaveBeenCalled();
  });
});
