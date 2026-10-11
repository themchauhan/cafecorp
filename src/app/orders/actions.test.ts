import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  collectionAdd,
  docGet,
  runTransaction,
  txGet,
  txUpdate,
  txSet,
  getSessionProfileMock,
  logAuditMock,
} = vi.hoisted(() => ({
  collectionAdd: vi.fn(),
  docGet: vi.fn(),
  runTransaction: vi.fn(),
  txGet: vi.fn(),
  txUpdate: vi.fn(),
  txSet: vi.fn(),
  getSessionProfileMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ add: collectionAdd, doc: () => ({ id: 'order-1' }) }),
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
  markOrderReady,
  sendToKitchen,
  updateOrderItemQuantity,
} from './actions';

const staff = { uid: 'staff-1', role: 'STAFF' as const, tenantId: 'tenant-a' };

// The transaction mock just runs the callback with a `tx` whose
// get()/update()/set() delegate to shared mocks keyed by doc path, so
// each test configures txGet's return values per call order.
function tx() {
  return { get: txGet, update: txUpdate, set: txSet };
}

describe('createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(staff);
    runTransaction.mockImplementation(async (fn) => fn(tx()));
    // Default: first order of the day (counter doc doesn't exist yet).
    txGet.mockResolvedValue({ data: () => undefined });
    // Default for whichever call isn't overridden by a test-specific
    // mockResolvedValueOnce below — covers both the DINE_IN table
    // check and the tenant tax-rate read, in whichever order a given
    // test's code path makes them.
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ active: true, taxRatePercent: 0 }),
    });
  });

  it('rejects a non-STAFF/ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue(null);
    const result = await createOrder({ orderType: 'TAKEAWAY' });
    expect(result.ok).toBe(false);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('creates an OPEN TAKEAWAY/PARCEL order with no tableId, ticket #1', async () => {
    const result = await createOrder({ orderType: 'TAKEAWAY' });
    expect(txSet).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        ticketNumber: 1,
        orderType: 'TAKEAWAY',
        tableId: null,
        status: 'OPEN',
        items: [],
        createdBy: 'staff-1',
        taxRatePercent: 0,
        discount: null,
      }),
    );
    expect(result).toEqual({ ok: true, data: { id: 'order-1' } });
  });

  it('assigns sequential ticket numbers within the same day', async () => {
    txGet.mockResolvedValueOnce({ data: () => undefined }); // first order today
    await createOrder({ orderType: 'TAKEAWAY' });
    const [, firstOrder] = txSet.mock.calls[1] as [unknown, { ticketNumber: number }];
    expect(firstOrder.ticketNumber).toBe(1);

    txGet.mockResolvedValueOnce({ data: () => ({ count: 1 }) }); // counter now at 1
    await createOrder({ orderType: 'TAKEAWAY' });
    const [, secondOrder] = txSet.mock.calls[3] as [unknown, { ticketNumber: number }];
    expect(secondOrder.ticketNumber).toBe(2);
  });

  it("snapshots the tenant's currently-configured tax rate onto the new order", async () => {
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ taxRatePercent: 5 }),
    });
    await createOrder({ orderType: 'TAKEAWAY' });
    expect(txSet).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ taxRatePercent: 5 }),
    );
  });

  it('rejects a DINE_IN order with no tableId', async () => {
    const result = await createOrder({ orderType: 'DINE_IN' });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/choose a table/i),
    });
    expect(runTransaction).not.toHaveBeenCalled();
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
    expect(runTransaction).not.toHaveBeenCalled();
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
    expect(runTransaction).not.toHaveBeenCalled();
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
    expect(txSet).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
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

describe('markOrderReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(staff);
    runTransaction.mockImplementation(async (fn) => fn(tx()));
  });

  it('rejects a non-STAFF/ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue(null);
    const result = await markOrderReady('order-1');
    expect(result.ok).toBe(false);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("rejects an order that doesn't exist in this tenant", async () => {
    txGet.mockResolvedValueOnce({ exists: false });
    const result = await markOrderReady('ghost');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such order/i),
    });
  });

  it("rejects an order that isn't in the kitchen (KOT_SENT)", async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'OPEN' }),
    });
    const result = await markOrderReady('order-1');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/only a ticket in the kitchen/i),
    });
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('marks a KOT_SENT order as SERVED', async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'KOT_SENT' }),
    });
    const result = await markOrderReady('order-1');
    expect(txUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'SERVED' }),
    );
    expect(result).toEqual({ ok: true, data: undefined });
  });
});
