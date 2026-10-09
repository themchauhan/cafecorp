import { describe, expect, it, vi, beforeEach } from 'vitest';

const { docSet, getSessionProfileMock, logAuditMock } = vi.hoisted(() => ({
  docSet: vi.fn(),
  getSessionProfileMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { doc: () => ({ set: docSet }) },
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

import { updateTaxRate } from './actions';

const admin = { uid: 'admin-1', role: 'ADMIN' as const, tenantId: 'tenant-a' };

describe('updateTaxRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(admin);
  });

  it('rejects a non-ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue({
      uid: 's1',
      role: 'STAFF',
      tenantId: 'tenant-a',
    });
    const result = await updateTaxRate({ taxRatePercent: 5 });
    expect(result.ok).toBe(false);
    expect(docSet).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range rate', async () => {
    const result = await updateTaxRate({ taxRatePercent: 150 });
    expect(result.ok).toBe(false);
    expect(docSet).not.toHaveBeenCalled();
  });

  it("sets the tenant's tax rate and logs an audit entry", async () => {
    const result = await updateTaxRate({ taxRatePercent: 5 });
    expect(result.ok).toBe(true);
    expect(docSet).toHaveBeenCalledWith({ taxRatePercent: 5 }, { merge: true });
    expect(logAuditMock).toHaveBeenCalledWith(
      admin,
      'TAX_RATE_UPDATED',
      'tenant',
      'tenant-a',
      { taxRatePercent: 5 },
    );
  });
});
