import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  collectionAdd,
  docGet,
  runTransaction,
  txGet,
  txUpdate,
  getSessionProfileMock,
  logAuditMock,
} = vi.hoisted(() => ({
  collectionAdd: vi.fn(),
  docGet: vi.fn(),
  runTransaction: vi.fn(),
  txGet: vi.fn(),
  txUpdate: vi.fn(),
  getSessionProfileMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ add: collectionAdd }),
    doc: (path: string) => ({ path, get: docGet }),
    runTransaction: (fn: (tx: unknown) => unknown) => runTransaction(fn),
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

import {
  addOrderItem,
  createOrder,
  sendToKitchen,
  updateOrderItemQuantity,
} from './actions';

const staff = { uid: 'staff-1', role: 'STAFF' as const, tenantId: 'tenant-a' };

// The transaction mock just runs the callback with a `tx` whose
// get()/update() delegate to shared mocks keyed by doc path, so each
// test configures txGet's return values per call order.
function tx() {
  return { get: txGet, update: txUpdate };
}

describe('createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(staff);
    collectionAdd.mockResolvedValue({ id: 'order-1' });
  });

  it('rejects a non-STAFF/ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue(null);
    const result = await createOrder({ orderType: 'TAKEAWAY' });
    expect(result.ok).toBe(false);
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it('creates an OPEN TAKEAWAY/PARCEL order with no tableId', async () => {
    const result = await createOrder({ orderType: 'TAKEAWAY' });
    expect(collectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        orderType: 'TAKEAWAY',
        tableId: null,
        status: 'OPEN',
        items: [],
        createdBy: 'staff-1',
      }),
    );
    expect(result).toEqual({ ok: true, data: { id: 'order-1' } });
  });

  it('rejects a DINE_IN order with no tableId', async () => {
    const result = await createOrder({ orderType: 'DINE_IN' });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/choose a table/i),
    });
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it("rejects a tableId that doesn't exist in this tenant", async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await createOrder({
      orderType: 'DINE_IN',
      tableId: 'ghost-table',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/not available/i),
    });
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it('rejects a deactivated table', async () => {
    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ active: false }),
    });
    const result = await createOrder({
      orderType: 'DINE_IN',
      tableId: 'table-1',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/not available/i),
    });
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it('creates a DINE_IN order with a valid, active tableId', async () => {
    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ active: true }),
    });
    const result = await createOrder({
      orderType: 'DINE_IN',
      tableId: 'table-1',
    });
    expect(collectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'DINE_IN', tableId: 'table-1' }),
    );
    expect(result).toEqual({ ok: true, data: { id: 'order-1' } });
  });
});

describe('addOrderItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(staff);
    runTransaction.mockImplementation(async (fn) => fn(tx()));
  });

  it("rejects an order that doesn't exist in this tenant", async () => {
    txGet.mockResolvedValueOnce({ exists: false }); // order
    const result = await addOrderItem({
      orderId: 'ghost',
      menuItemId: 'item-1',
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such order/i),
    });
  });

  it("rejects a menuItemId that doesn't exist in this tenant", async () => {
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'OPEN', items: [] }),
      })
      .mockResolvedValueOnce({ exists: false }); // menu item
    const result = await addOrderItem({
      orderId: 'order-1',
      menuItemId: 'ghost',
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such menu item/i),
    });
  });

  it("rejects adding to an order that isn't OPEN", async () => {
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'KOT_SENT', items: [] }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: 'Tea', price: 20, available: true }),
      });
    const result = await addOrderItem({
      orderId: 'order-1',
      menuItemId: 'item-1',
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/still open/i),
    });
  });

  it('rejects an unavailable menu item', async () => {
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'OPEN', items: [] }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: 'Tea', price: 20, available: false }),
      });
    const result = await addOrderItem({
      orderId: 'order-1',
      menuItemId: 'item-1',
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/unavailable/i),
    });
  });

  it('snapshots the current price onto a new line item', async () => {
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'OPEN', items: [] }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: 'Tea', price: 20, available: true }),
      });
    await addOrderItem({
      orderId: 'order-1',
      menuItemId: 'item-1',
      quantity: 2,
    });
    expect(txUpdate).toHaveBeenCalledWith(expect.anything(), {
      items: [
        {
          menuItemId: 'item-1',
          name: 'Tea',
          quantity: 2,
          priceSnapshot: 20,
          notes: '',
        },
      ],
    });
  });

  it('merges into an existing line for the same menu item instead of duplicating it', async () => {
    const existing = [
      {
        menuItemId: 'item-1',
        name: 'Tea',
        quantity: 1,
        priceSnapshot: 20,
        notes: '',
      },
    ];
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'OPEN', items: existing }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: 'Tea', price: 20, available: true }),
      });
    await addOrderItem({
      orderId: 'order-1',
      menuItemId: 'item-1',
      quantity: 1,
    });
    expect(txUpdate).toHaveBeenCalledWith(expect.anything(), {
      items: [
        {
          menuItemId: 'item-1',
          name: 'Tea',
          quantity: 2,
          priceSnapshot: 20,
          notes: '',
        },
      ],
    });
  });

  it("keeps a later price change from rewriting an already-added line's snapshot", async () => {
    const existing = [
      {
        menuItemId: 'item-1',
        name: 'Tea',
        quantity: 1,
        priceSnapshot: 20,
        notes: '',
      },
    ];
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'OPEN', items: existing }),
      })
      // Price changed to 30 since the item was first added.
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: 'Tea', price: 30, available: true }),
      });
    await addOrderItem({
      orderId: 'order-1',
      menuItemId: 'item-1',
      quantity: 1,
    });
    const [, updatePayload] = txUpdate.mock.calls[0] as [
      unknown,
      { items: { priceSnapshot: number }[] },
    ];
    expect(updatePayload.items[0].priceSnapshot).toBe(20);
  });
});

describe('updateOrderItemQuantity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(staff);
    runTransaction.mockImplementation(async (fn) => fn(tx()));
  });

  it("rejects an order that doesn't exist in this tenant", async () => {
    txGet.mockResolvedValueOnce({ exists: false });
    const result = await updateOrderItemQuantity({
      orderId: 'ghost',
      index: 0,
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such order/i),
    });
  });

  it('removes the line when quantity is set to 0', async () => {
    const items = [
      {
        menuItemId: 'item-1',
        name: 'Tea',
        quantity: 2,
        priceSnapshot: 20,
        notes: '',
      },
    ];
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'OPEN', items }),
    });
    await updateOrderItemQuantity({
      orderId: 'order-1',
      index: 0,
      quantity: 0,
    });
    expect(txUpdate).toHaveBeenCalledWith(expect.anything(), { items: [] });
  });

  it('rejects editing items on a non-OPEN order', async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'BILLED', items: [] }),
    });
    const result = await updateOrderItemQuantity({
      orderId: 'order-1',
      index: 0,
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/still open/i),
    });
  });
});

describe('sendToKitchen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(staff);
    runTransaction.mockImplementation(async (fn) => fn(tx()));
  });

  it("rejects an order that doesn't exist in this tenant", async () => {
    txGet.mockResolvedValueOnce({ exists: false });
    const result = await sendToKitchen('ghost');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such order/i),
    });
  });

  it('rejects sending an order with no items', async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'OPEN', items: [] }),
    });
    const result = await sendToKitchen('order-1');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/add at least one item/i),
    });
  });

  it("rejects sending an order that isn't OPEN", async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'KOT_SENT', items: [{}] }),
    });
    const result = await sendToKitchen('order-1');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/already been sent/i),
    });
  });

  it('marks an OPEN order with items as KOT_SENT', async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'OPEN', items: [{ menuItemId: 'item-1' }] }),
    });
    await sendToKitchen('order-1');
    expect(txUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'KOT_SENT' }),
    );
  });
});
