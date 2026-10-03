import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  collectionAdd,
  docGet,
  docUpdate,
  getSessionProfileMock,
  logAuditMock,
} = vi.hoisted(() => ({
  collectionAdd: vi.fn(),
  docGet: vi.fn(),
  docUpdate: vi.fn(),
  getSessionProfileMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ add: collectionAdd }),
    doc: () => ({ get: docGet, update: docUpdate }),
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

import { createTable, setTableActive, updateTable } from './actions';

const admin = { uid: 'admin-1', role: 'ADMIN' as const, tenantId: 'tenant-a' };
const staff = { uid: 'staff-1', role: 'STAFF' as const, tenantId: 'tenant-a' };

describe('createTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(admin);
    collectionAdd.mockResolvedValue({ id: 'table-1' });
  });

  it('rejects a non-ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue(staff);
    const result = await createTable({ label: 'T1' });
    expect(result.ok).toBe(false);
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it('creates a new table as active by default', async () => {
    const result = await createTable({ label: 'T1' });
    expect(result.ok).toBe(true);
    expect(collectionAdd).toHaveBeenCalledWith({ label: 'T1', active: true });
  });
});

describe('updateTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(admin);
  });

  it("rejects a table that doesn't exist in this tenant", async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await updateTable({ id: 'ghost', label: 'T9' });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such table/i),
    });
  });

  it('updates the label', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    const result = await updateTable({ id: 'table-1', label: 'T1 Renamed' });
    expect(result.ok).toBe(true);
    expect(docUpdate).toHaveBeenCalledWith({ label: 'T1 Renamed' });
  });
});

describe('setTableActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(admin);
  });

  it('toggles active and logs the direction', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    const result = await setTableActive({ id: 'table-1', active: false });
    expect(result.ok).toBe(true);
    expect(docUpdate).toHaveBeenCalledWith({ active: false });
    expect(logAuditMock).toHaveBeenCalledWith(
      admin,
      'TABLE_DEACTIVATED',
      'cafeTable',
      'table-1',
      {},
    );
  });
});
