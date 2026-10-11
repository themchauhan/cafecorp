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

import { updateGstSettings, updateTaxRate } from './actions';

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

const validGstInput = {
  gstEnabled: true,
  gstin: '09AAACH7409R1ZZ',
  gstLegalName: 'Demo Cafe Pvt Ltd',
  gstAddress: '1 MG Road, Prayagraj',
  gstSacCode: '996331',
};

describe('updateGstSettings', () => {
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
    const result = await updateGstSettings(validGstInput);
    expect(result.ok).toBe(false);
    expect(docSet).not.toHaveBeenCalled();
  });

  it('enables GST invoicing with valid details', async () => {
    const result = await updateGstSettings(validGstInput);
    expect(result.ok).toBe(true);
    expect(docSet).toHaveBeenCalledWith(
      {
        gstEnabled: true,
        gstin: '09AAACH7409R1ZZ',
        gstLegalName: 'Demo Cafe Pvt Ltd',
        gstAddress: '1 MG Road, Prayagraj',
        gstSacCode: '996331',
      },
      { merge: true },
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      admin,
      'GST_SETTINGS_UPDATED',
      'tenant',
      'tenant-a',
      { gstEnabled: true },
    );
  });

  it('rejects a malformed GSTIN', async () => {
    const result = await updateGstSettings({
      ...validGstInput,
      gstin: 'not-a-gstin',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/doesn.t look right/i),
    });
    expect(docSet).not.toHaveBeenCalled();
  });

  it('rejects a missing legal name', async () => {
    const result = await updateGstSettings({
      ...validGstInput,
      gstLegalName: '',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/business name/i),
    });
    expect(docSet).not.toHaveBeenCalled();
  });

  it('rejects a missing address', async () => {
    const result = await updateGstSettings({
      ...validGstInput,
      gstAddress: '',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/business address/i),
    });
    expect(docSet).not.toHaveBeenCalled();
  });

  it('clears GST fields when disabling, without validating them', async () => {
    const result = await updateGstSettings({
      gstEnabled: false,
      gstin: '',
      gstLegalName: '',
      gstAddress: '',
      gstSacCode: '',
    });
    expect(result.ok).toBe(true);
    expect(docSet).toHaveBeenCalledWith(
      {
        gstEnabled: false,
        gstin: null,
        gstLegalName: null,
        gstAddress: null,
        gstSacCode: null,
      },
      { merge: true },
    );
  });
});
