import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  collectionAdd,
  collectionWhere,
  docGet,
  docSet,
  docUpdate,
  getUserByEmail,
  createUser,
  setCustomUserClaims,
  generatePasswordResetLink,
  getSessionProfileMock,
  logPlatformAuditMock,
} = vi.hoisted(() => ({
  collectionAdd: vi.fn(),
  collectionWhere: vi.fn(),
  docGet: vi.fn(),
  docSet: vi.fn(),
  docUpdate: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  setCustomUserClaims: vi.fn(),
  generatePasswordResetLink: vi.fn(),
  getSessionProfileMock: vi.fn(),
  logPlatformAuditMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ add: collectionAdd, where: collectionWhere }),
    doc: () => ({ get: docGet, set: docSet, update: docUpdate }),
  },
  adminAuth: {
    getUserByEmail,
    createUser,
    setCustomUserClaims,
    generatePasswordResetLink,
  },
}));

vi.mock('@/lib/auth/audit', () => ({ logPlatformAudit: logPlatformAuditMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/auth/session', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/session')>(
      '@/lib/auth/session',
    );
  return {
    ...actual,
    getSessionProfile: getSessionProfileMock,
  };
});

import {
  changeTenantPlan,
  createTenant,
  inviteTenantAdmin,
  recordSubscriptionPayment,
  setTenantExpiry,
  setTenantStatus,
} from './actions';

const superAdmin = {
  uid: 'super-1',
  role: 'SUPER_ADMIN' as const,
  tenantId: undefined,
};
const admin = { uid: 'admin-1', role: 'ADMIN' as const, tenantId: 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
  getSessionProfileMock.mockResolvedValue(superAdmin);
});

describe('createTenant', () => {
  it('rejects a non-SUPER_ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue(admin);
    const result = await createTenant({
      name: 'A',
      phone: '1',
      email: 'a@a.com',
      plan: 'TRIAL',
    });
    expect(result.ok).toBe(false);
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it('creates a TRIAL tenant with a 14-day trial end date', async () => {
    collectionAdd.mockResolvedValue({ id: 'tenant-new' });
    const result = await createTenant({
      name: 'New Cafe',
      phone: '+91 1',
      email: 'owner@new.cafe',
      plan: 'TRIAL',
    });
    expect(result).toEqual({ ok: true, data: { id: 'tenant-new' } });
    expect(collectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Cafe',
        status: 'ACTIVE',
        plan: 'TRIAL',
        subscriptionEndsAt: null,
      }),
    );
    const written = collectionAdd.mock.calls[0][0];
    expect(written.trialEndsAt).not.toBeNull();
    expect(logPlatformAuditMock).toHaveBeenCalledWith(
      superAdmin,
      'TENANT_CREATED',
      'tenant-new',
      'tenant',
      'tenant-new',
      { name: 'New Cafe', plan: 'TRIAL' },
    );
  });

  it('creates a PAID tenant with no trial end date', async () => {
    collectionAdd.mockResolvedValue({ id: 'tenant-new' });
    await createTenant({
      name: 'Paid Cafe',
      phone: '+91 1',
      email: 'a@a.com',
      plan: 'PAID',
    });
    expect(collectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'PAID', trialEndsAt: null }),
    );
  });
});

describe('inviteTenantAdmin', () => {
  it('rejects a non-SUPER_ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue(admin);
    const result = await inviteTenantAdmin({
      tenantId: 'tenant-a',
      email: 'x@x.com',
      name: 'X',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a tenant that does not exist', async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await inviteTenantAdmin({
      tenantId: 'ghost',
      email: 'x@x.com',
      name: 'X',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such tenant/i),
    });
  });

  it('creates a new Firebase Auth user when none exists for the email', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    getUserByEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });
    createUser.mockResolvedValueOnce({ uid: 'new-uid' });
    generatePasswordResetLink.mockResolvedValueOnce('https://reset.link/abc');

    const result = await inviteTenantAdmin({
      tenantId: 'tenant-a',
      email: 'newadmin@a.com',
      name: 'New Admin',
    });

    expect(createUser).toHaveBeenCalled();
    expect(setCustomUserClaims).toHaveBeenCalledWith('new-uid', {
      role: 'ADMIN',
      tenantId: 'tenant-a',
    });
    expect(docSet).toHaveBeenCalledWith({
      name: 'New Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    expect(result).toEqual({
      ok: true,
      data: { resetLink: 'https://reset.link/abc' },
    });
    expect(logPlatformAuditMock).toHaveBeenCalledWith(
      superAdmin,
      'TENANT_ADMIN_INVITED',
      'tenant-a',
      'profile',
      'new-uid',
      { email: 'newadmin@a.com' },
    );
  });

  it('reuses an existing Firebase Auth user for the email', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    getUserByEmail.mockResolvedValueOnce({ uid: 'existing-uid' });
    generatePasswordResetLink.mockResolvedValueOnce('https://reset.link/xyz');

    await inviteTenantAdmin({
      tenantId: 'tenant-a',
      email: 'existing@a.com',
      name: 'Existing',
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(setCustomUserClaims).toHaveBeenCalledWith('existing-uid', {
      role: 'ADMIN',
      tenantId: 'tenant-a',
    });
  });
});

describe('setTenantStatus', () => {
  it('rejects a tenant that does not exist', async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await setTenantStatus({
      tenantId: 'ghost',
      status: 'SUSPENDED',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such tenant/i),
    });
  });

  it('suspends an active tenant and logs TENANT_SUSPENDED', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    const result = await setTenantStatus({
      tenantId: 'tenant-a',
      status: 'SUSPENDED',
    });
    expect(result.ok).toBe(true);
    expect(docUpdate).toHaveBeenCalledWith({ status: 'SUSPENDED' });
    expect(logPlatformAuditMock).toHaveBeenCalledWith(
      superAdmin,
      'TENANT_SUSPENDED',
      'tenant-a',
      'tenant',
      'tenant-a',
      {},
    );
  });

  it('reactivates a tenant and logs TENANT_ACTIVATED', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    await setTenantStatus({ tenantId: 'tenant-a', status: 'ACTIVE' });
    expect(logPlatformAuditMock).toHaveBeenCalledWith(
      superAdmin,
      'TENANT_ACTIVATED',
      'tenant-a',
      'tenant',
      'tenant-a',
      {},
    );
  });
});

describe('changeTenantPlan', () => {
  it('rejects a tenant that does not exist', async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await changeTenantPlan({
      tenantId: 'ghost',
      plan: 'PAID',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such tenant/i),
    });
  });

  it('updates the plan', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    const result = await changeTenantPlan({
      tenantId: 'tenant-a',
      plan: 'PAID',
    });
    expect(result.ok).toBe(true);
    expect(docUpdate).toHaveBeenCalledWith({ plan: 'PAID' });
  });
});

describe('setTenantExpiry', () => {
  it('rejects when neither date is provided', async () => {
    const result = await setTenantExpiry({ tenantId: 'tenant-a' });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/provide a trial or subscription end date/i),
    });
    expect(docGet).not.toHaveBeenCalled();
  });

  it('rejects a tenant that does not exist', async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await setTenantExpiry({
      tenantId: 'ghost',
      trialEndsAt: '2026-12-01',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such tenant/i),
    });
  });

  it('updates only the trial end date when provided', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    const result = await setTenantExpiry({
      tenantId: 'tenant-a',
      trialEndsAt: '2026-12-01',
    });
    expect(result.ok).toBe(true);
    expect(docUpdate).toHaveBeenCalledWith({
      trialEndsAt: new Date('2026-12-01').toISOString(),
    });
  });

  it('updates only the subscription end date when provided', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    await setTenantExpiry({
      tenantId: 'tenant-a',
      subscriptionEndsAt: '2026-12-01',
    });
    expect(docUpdate).toHaveBeenCalledWith({
      subscriptionEndsAt: new Date('2026-12-01').toISOString(),
    });
  });
});

describe('recordSubscriptionPayment', () => {
  it('rejects a tenant that does not exist', async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await recordSubscriptionPayment({
      tenantId: 'ghost',
      amount: 100,
      paymentMethod: 'UPI',
      referenceNumber: 'ref-1',
      periodStart: '2026-10-01',
      periodEnd: '2026-11-01',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such tenant/i),
    });
  });

  it('records the payment and extends the tenant to PAID', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    collectionAdd.mockResolvedValueOnce({ id: 'payment-1' });

    const result = await recordSubscriptionPayment({
      tenantId: 'tenant-a',
      amount: 999,
      paymentMethod: 'UPI',
      referenceNumber: 'ref-1',
      periodStart: '2026-10-01',
      periodEnd: '2026-11-01',
    });
    expect(result.ok).toBe(true);

    expect(collectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        amount: 999,
        paymentMethod: 'UPI',
        referenceNumber: 'ref-1',
        periodStart: new Date('2026-10-01').toISOString(),
        periodEnd: new Date('2026-11-01').toISOString(),
      }),
    );
    expect(docUpdate).toHaveBeenCalledWith({
      plan: 'PAID',
      subscriptionEndsAt: new Date('2026-11-01').toISOString(),
    });
    expect(logPlatformAuditMock).toHaveBeenCalledWith(
      superAdmin,
      'SUBSCRIPTION_PAYMENT_RECORDED',
      'tenant-a',
      'subscriptionPayment',
      'payment-1',
      {
        amount: 999,
        paymentMethod: 'UPI',
        periodEnd: new Date('2026-11-01').toISOString(),
      },
    );
  });
});
