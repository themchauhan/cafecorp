import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  runTransaction,
  txGet,
  txUpdate,
  txSet,
  getSessionProfileMock,
  logAuditMock,
} = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  txGet: vi.fn(),
  txUpdate: vi.fn(),
  txSet: vi.fn(),
  getSessionProfileMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    doc: (path: string) => ({ path, get: txGet, update: txUpdate, set: txSet }),
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

import { addPayment, cancelOrder } from './billing-actions';

const staff = { uid: 'staff-1', role: 'STAFF' as const, tenantId: 'tenant-a' };

function tx() {
  return { get: txGet, update: txUpdate, set: txSet };
}

describe('addPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(staff);
    runTransaction.mockImplementation(async (fn) => fn(tx()));
  });

  it("rejects an order that doesn't exist in this tenant", async () => {
    txGet.mockResolvedValueOnce({ exists: false });
    const result = await addPayment({
      orderId: 'ghost',
      amount: 10,
      mode: 'CASH',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such order/i),
    });
  });

  it("rejects a payment on an order that's already BILLED", async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'BILLED', items: [], payments: [] }),
    });
    const result = await addPayment({
      orderId: 'order-1',
      amount: 10,
      mode: 'CASH',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no longer accept payments/i),
    });
  });

  it('records a partial payment without billing the order', async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'KOT_SENT',
        items: [
          {
            menuItemId: 'item-1',
            name: 'Tea',
            quantity: 2,
            priceSnapshot: 20,
            notes: '',
          },
        ],
        payments: [],
      }),
    });
    const result = await addPayment({
      orderId: 'order-1',
      amount: 20,
      mode: 'CASH',
    });
    expect(result).toEqual({ ok: true, data: { billed: false } });
    expect(txUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payments: [expect.objectContaining({ amount: 20, mode: 'CASH' })],
      }),
    );
    // Should not transition status or touch dailySummaries.
    const updatePayload = txUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(updatePayload.status).toBeUndefined();
    expect(txSet).not.toHaveBeenCalled();
  });

  it('bills the order once payments cover the total, and writes dailySummaries', async () => {
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'KOT_SENT',
          items: [
            {
              menuItemId: 'item-1',
              name: 'Tea',
              quantity: 2,
              priceSnapshot: 20,
              notes: '',
            },
          ],
          payments: [],
        }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ categoryId: 'cat-beverages' }),
      });

    const result = await addPayment({
      orderId: 'order-1',
      amount: 40,
      mode: 'UPI',
    });
    expect(result).toEqual({ ok: true, data: { billed: true } });

    const [, updatePayload] = txUpdate.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(updatePayload.status).toBe('BILLED');

    expect(txSet).toHaveBeenCalledTimes(1);
    const [, summaryUpdate] = txSet.mock.calls[0] as [
      unknown,
      {
        totalsByMode: Record<string, unknown>;
        totalsByStaff: Record<string, unknown>;
        itemsSold: Record<string, unknown>;
        categorySales: Record<string, unknown>;
      },
    ];
    // Real nested objects, not flat dotted-string keys — set(...,
    // {merge: true}) does NOT split a dotted key like
    // "totalsByMode.UPI" into a nested field the way update() does;
    // it would otherwise write a literal field with a dot in its name.
    expect(summaryUpdate.totalsByMode.UPI).toBeDefined();
    expect(summaryUpdate.totalsByStaff['staff-1']).toBeDefined();
    expect(summaryUpdate.itemsSold['item-1']).toBeDefined();
    expect(summaryUpdate.categorySales['cat-beverages']).toBeDefined();
  });

  it('sums two payments in the same mode into one increment instead of overwriting it', async () => {
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'KOT_SENT',
          items: [
            {
              menuItemId: 'item-1',
              name: 'Tea',
              quantity: 1,
              priceSnapshot: 40,
              notes: '',
            },
          ],
          // Two earlier CASH payments, already on the order.
          payments: [
            {
              amount: 15,
              mode: 'CASH',
              receivedBy: 'staff-1',
              receivedAt: 'x',
            },
            {
              amount: 15,
              mode: 'CASH',
              receivedBy: 'staff-1',
              receivedAt: 'y',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ categoryId: 'cat-1' }),
      });

    // Final CASH payment tips it over the 40 total.
    await addPayment({ orderId: 'order-1', amount: 10, mode: 'CASH' });

    const [, summaryUpdate] = txSet.mock.calls[0] as [
      unknown,
      {
        totalsByMode: Record<
          string,
          { transformType?: string; operand?: number }
        >;
      },
    ];
    // All three CASH payments (15 + 15 + 10 = 40) must collapse into
    // a single increment(40) for the CASH key, not the last call's
    // increment(10) overwriting the earlier ones.
    expect(summaryUpdate.totalsByMode.CASH).toMatchObject({ operand: 40 });
  });

  it('sums split payments across two modes before deciding whether the order is billed', async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'KOT_SENT',
        items: [
          {
            menuItemId: 'item-1',
            name: 'Tea',
            quantity: 2,
            priceSnapshot: 20,
            notes: '',
          },
        ],
        payments: [
          { amount: 15, mode: 'CASH', receivedBy: 'staff-1', receivedAt: 'x' },
        ],
      }),
    });
    // Total is 40; 15 already paid, this payment of 10 is still short.
    const result = await addPayment({
      orderId: 'order-1',
      amount: 10,
      mode: 'UPI',
    });
    expect(result).toEqual({ ok: true, data: { billed: false } });
  });
});

describe('cancelOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(staff);
    runTransaction.mockImplementation(async (fn) => fn(tx()));
  });

  it("rejects an order that doesn't exist in this tenant", async () => {
    txGet.mockResolvedValueOnce({ exists: false });
    const result = await cancelOrder({ orderId: 'ghost', reason: 'x' });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such order/i),
    });
  });

  it("rejects cancelling an order that's already BILLED", async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'BILLED' }),
    });
    const result = await cancelOrder({
      orderId: 'order-1',
      reason: 'customer left',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/already billed/i),
    });
  });

  it("rejects cancelling an order that's already CANCELLED", async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'CANCELLED' }),
    });
    const result = await cancelOrder({ orderId: 'order-1', reason: 'again' });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/already cancelled/i),
    });
  });

  it('cancels an OPEN order and records the reason', async () => {
    txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'OPEN' }),
    });
    const result = await cancelOrder({
      orderId: 'order-1',
      reason: 'customer left',
    });
    expect(result.ok).toBe(true);
    expect(txUpdate).toHaveBeenCalledWith(expect.anything(), {
      status: 'CANCELLED',
      cancelReason: 'customer left',
    });
  });
});
