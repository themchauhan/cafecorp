import { describe, expect, it, vi, beforeEach } from 'vitest';

const { collectionAdd } = vi.hoisted(() => ({ collectionAdd: vi.fn() }));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: () => ({ add: collectionAdd }) },
}));

import { logAudit, logPlatformAudit } from './audit';

const tenantProfile = {
  uid: 'u1',
  role: 'ADMIN' as const,
  tenantId: 'tenant-a',
};
const superAdminProfile = {
  uid: 'u2',
  role: 'SUPER_ADMIN' as const,
  tenantId: null,
};

describe('logAudit', () => {
  beforeEach(() => {
    collectionAdd.mockReset();
  });

  it('writes userId/action/targetType/targetId/metadata', async () => {
    await logAudit(tenantProfile, 'ORDER_CREATED', 'order', 'order-1', {
      orderType: 'TAKEAWAY',
    });
    expect(collectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'ORDER_CREATED',
        targetType: 'order',
        targetId: 'order-1',
        metadata: { orderType: 'TAKEAWAY' },
      }),
    );
  });

  it('strips undefined values from metadata instead of letting Firestore reject the write', async () => {
    await logAudit(tenantProfile, 'ORDER_CREATED', 'order', 'order-1', {
      orderType: 'TAKEAWAY',
      tableId: undefined,
    });
    const [payload] = collectionAdd.mock.calls[0] as [
      { metadata: Record<string, unknown> },
    ];
    expect(payload.metadata).toEqual({ orderType: 'TAKEAWAY' });
    expect('tableId' in payload.metadata).toBe(false);
  });

  it('is a no-op for SUPER_ADMIN (not tenant-scoped)', async () => {
    await logAudit(superAdminProfile, 'SOMETHING', 'x', 'y', {});
    expect(collectionAdd).not.toHaveBeenCalled();
  });
});

describe('logPlatformAudit', () => {
  beforeEach(() => {
    collectionAdd.mockReset();
  });

  it("writes into the affected tenant's auditLogs, not the super admin's (who has none)", async () => {
    await logPlatformAudit(
      superAdminProfile,
      'TENANT_SUSPENDED',
      'tenant-a',
      'tenant',
      'tenant-a',
      { reason: 'non-payment' },
    );
    expect(collectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u2',
        action: 'TENANT_SUSPENDED',
        targetType: 'tenant',
        targetId: 'tenant-a',
        metadata: { reason: 'non-payment' },
      }),
    );
  });

  it('also strips undefined metadata values', async () => {
    await logPlatformAudit(
      superAdminProfile,
      'X',
      'tenant-a',
      'tenant',
      'tenant-a',
      {
        a: 1,
        b: undefined,
      },
    );
    const [payload] = collectionAdd.mock.calls[0] as [
      { metadata: Record<string, unknown> },
    ];
    expect(payload.metadata).toEqual({ a: 1 });
  });
});
