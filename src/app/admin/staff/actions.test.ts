import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  getUserByEmail,
  createUser,
  setCustomUserClaims,
  generatePasswordResetLink,
  revokeRefreshTokens,
  docGet,
  docSet,
  docUpdate,
  getSessionProfileMock,
  logAuditMock,
} = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  setCustomUserClaims: vi.fn(),
  generatePasswordResetLink: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  docGet: vi.fn(),
  docSet: vi.fn(),
  docUpdate: vi.fn(),
  getSessionProfileMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: {
    getUserByEmail,
    createUser,
    setCustomUserClaims,
    generatePasswordResetLink,
    revokeRefreshTokens,
  },
  adminDb: {
    doc: () => ({ get: docGet, set: docSet, update: docUpdate }),
  },
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

import { inviteStaff, setStaffStatus } from './actions';

const admin = { uid: 'admin-1', role: 'ADMIN' as const, tenantId: 'tenant-a' };

describe('inviteStaff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(admin);
    generatePasswordResetLink.mockResolvedValue('https://example.com/reset');
  });

  it("creates a new Firebase Auth user and scopes claims to the admin's own tenant", async () => {
    getUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    createUser.mockResolvedValue({ uid: 'new-uid' });

    const result = await inviteStaff({
      email: 'staff@demo.cafe',
      name: 'New Staff',
      role: 'STAFF',
    });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'staff@demo.cafe',
        displayName: 'New Staff',
      }),
    );
    expect(setCustomUserClaims).toHaveBeenCalledWith('new-uid', {
      role: 'STAFF',
      tenantId: 'tenant-a', // from the session, never from the form
    });
    expect(docSet).toHaveBeenCalledWith({
      name: 'New Staff',
      role: 'STAFF',
      status: 'ACTIVE',
    });
    expect(result).toEqual({
      ok: true,
      data: { resetLink: 'https://example.com/reset' },
    });
  });

  it('reuses an existing Firebase Auth user instead of creating a duplicate', async () => {
    getUserByEmail.mockResolvedValue({ uid: 'existing-uid' });

    await inviteStaff({
      email: 'existing@demo.cafe',
      name: 'Existing',
      role: 'ADMIN',
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(setCustomUserClaims).toHaveBeenCalledWith('existing-uid', {
      role: 'ADMIN',
      tenantId: 'tenant-a',
    });
  });

  it('rejects a non-ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue({
      uid: 's1',
      role: 'STAFF',
      tenantId: 'tenant-a',
    });
    const result = await inviteStaff({
      email: 'x@demo.cafe',
      name: 'X',
      role: 'STAFF',
    });
    expect(result.ok).toBe(false);
  });
});

describe('setStaffStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(admin);
  });

  it('refuses to let an admin deactivate their own account', async () => {
    const result = await setStaffStatus({
      uid: admin.uid,
      status: 'DEACTIVATED',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/cannot change your own/i),
    });
    expect(docUpdate).not.toHaveBeenCalled();
  });

  it("throws if the target profile doesn't exist in this tenant", async () => {
    docGet.mockResolvedValue({ exists: false });
    const result = await setStaffStatus({
      uid: 'ghost',
      status: 'DEACTIVATED',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such staff member/i),
    });
  });

  it('updates status, revokes existing sessions, and logs an audit entry on deactivation', async () => {
    docGet.mockResolvedValue({ exists: true });
    const result = await setStaffStatus({
      uid: 'staff-1',
      status: 'DEACTIVATED',
    });
    expect(result.ok).toBe(true);
    expect(docUpdate).toHaveBeenCalledWith({ status: 'DEACTIVATED' });
    // Otherwise a deactivated account's existing session cookie keeps
    // working until it naturally expires — see the comment in actions.ts.
    expect(revokeRefreshTokens).toHaveBeenCalledWith('staff-1');
    expect(logAuditMock).toHaveBeenCalledWith(
      admin,
      'STAFF_DEACTIVATED',
      'profile',
      'staff-1',
      {},
    );
  });

  it('does not revoke sessions when reactivating an account', async () => {
    docGet.mockResolvedValue({ exists: true });
    const result = await setStaffStatus({
      uid: 'staff-1',
      status: 'ACTIVE',
    });
    expect(result.ok).toBe(true);
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });
});
