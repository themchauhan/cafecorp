import { describe, expect, it, vi, beforeEach } from 'vitest';

const { verifySessionCookie, docGet } = vi.hoisted(() => ({
  verifySessionCookie: vi.fn(),
  docGet: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifySessionCookie },
  adminDb: { doc: () => ({ get: docGet }) },
}));

import { cookies } from 'next/headers';
import {
  AuthError,
  getSessionProfile,
  requireActiveTenant,
  requireRole,
} from './session';
import type { SessionProfile } from './types';

const admin: SessionProfile = {
  uid: 'u1',
  role: 'ADMIN',
  tenantId: 'tenant-a',
};
const superAdmin: SessionProfile = {
  uid: 'u2',
  role: 'SUPER_ADMIN',
  tenantId: null,
};

describe('requireRole', () => {
  it('throws 401 when signed out', () => {
    expect(() => requireRole(null, ['ADMIN'])).toThrow(AuthError);
  });

  it("throws 403 when the role doesn't match", () => {
    expect(() => requireRole(admin, ['SUPER_ADMIN'])).toThrow(AuthError);
  });

  it('returns the profile when the role matches', () => {
    expect(requireRole(admin, ['ADMIN', 'SUPER_ADMIN'])).toBe(admin);
  });
});

describe('requireActiveTenant', () => {
  it('is a no-op for SUPER_ADMIN', async () => {
    docGet.mockClear();
    await expect(requireActiveTenant(superAdmin)).resolves.toBeUndefined();
    expect(docGet).not.toHaveBeenCalled();
  });

  it('throws if the tenant doc is missing', async () => {
    docGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await expect(requireActiveTenant(admin)).rejects.toThrow(AuthError);
  });

  it("throws if the tenant isn't ACTIVE", async () => {
    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'SUSPENDED', plan: 'TRIAL' }),
    });
    await expect(requireActiveTenant(admin)).rejects.toThrow(AuthError);
  });

  it('resolves when the tenant is ACTIVE with no expiry set', async () => {
    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'ACTIVE', plan: 'PAID' }),
    });
    await expect(requireActiveTenant(admin)).resolves.toBeUndefined();
  });

  it('throws if the tenant is ACTIVE but its trial has expired', async () => {
    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'ACTIVE',
        plan: 'TRIAL',
        trialEndsAt: '2020-01-01T00:00:00.000Z',
      }),
    });
    await expect(requireActiveTenant(admin)).rejects.toThrow(AuthError);
  });

  it('resolves if the tenant is ACTIVE and its subscription has not yet expired', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'ACTIVE',
        plan: 'PAID',
        subscriptionEndsAt: future,
      }),
    });
    await expect(requireActiveTenant(admin)).resolves.toBeUndefined();
  });
});

describe('getSessionProfile', () => {
  beforeEach(() => {
    verifySessionCookie.mockReset();
  });

  it('returns null when there is no cookie', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    await expect(getSessionProfile()).resolves.toBeNull();
  });

  it('returns null when the cookie fails verification', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'bad-cookie' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    verifySessionCookie.mockRejectedValue(new Error('expired'));

    await expect(getSessionProfile()).resolves.toBeNull();
  });

  it('returns null when the role claim is missing or invalid', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'good-cookie' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    verifySessionCookie.mockResolvedValue({ uid: 'u1' });

    await expect(getSessionProfile()).resolves.toBeNull();
  });

  it('decodes tenantId/role from a valid cookie', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'good-cookie' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    verifySessionCookie.mockResolvedValue({
      uid: 'u1',
      role: 'STAFF',
      tenantId: 'tenant-a',
    });

    await expect(getSessionProfile()).resolves.toEqual({
      uid: 'u1',
      role: 'STAFF',
      tenantId: 'tenant-a',
    });
  });

  it('maps a missing tenantId to null (SUPER_ADMIN case)', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'good-cookie' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    verifySessionCookie.mockResolvedValue({ uid: 'u2', role: 'SUPER_ADMIN' });

    await expect(getSessionProfile()).resolves.toEqual({
      uid: 'u2',
      role: 'SUPER_ADMIN',
      tenantId: null,
    });
  });
});
