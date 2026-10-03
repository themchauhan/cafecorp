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

import {
  createCategory,
  createMenuItem,
  setMenuItemAvailability,
  updateCategory,
  updateMenuItem,
} from './actions';

const admin = { uid: 'admin-1', role: 'ADMIN' as const, tenantId: 'tenant-a' };
const staff = { uid: 'staff-1', role: 'STAFF' as const, tenantId: 'tenant-a' };

describe('menu actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfileMock.mockResolvedValue(admin);
    collectionAdd.mockResolvedValue({ id: 'new-id' });
    docGet.mockResolvedValue({ exists: true });
  });

  it('createCategory rejects a non-ADMIN caller', async () => {
    getSessionProfileMock.mockResolvedValue(staff);
    const result = await createCategory({ name: 'Drinks', sortOrder: 0 });
    expect(result.ok).toBe(false);
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it('createCategory writes the category and logs an audit entry', async () => {
    const result = await createCategory({ name: 'Drinks', sortOrder: 0 });
    expect(result.ok).toBe(true);
    expect(collectionAdd).toHaveBeenCalledWith({
      name: 'Drinks',
      sortOrder: 0,
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      admin,
      'MENU_CATEGORY_CREATED',
      'menuCategory',
      'new-id',
      { name: 'Drinks', sortOrder: 0 },
    );
  });

  it("createMenuItem rejects a categoryId that doesn't exist in this tenant", async () => {
    docGet.mockResolvedValue({ exists: false });
    const result = await createMenuItem({
      categoryId: 'ghost-category',
      name: 'Tea',
      price: 20,
      vegFlag: true,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such category/i),
    });
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it('createMenuItem defaults a new item to available:true', async () => {
    const result = await createMenuItem({
      categoryId: 'cat-1',
      name: 'Tea',
      price: 20,
      vegFlag: true,
    });
    expect(result.ok).toBe(true);
    expect(collectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tea', available: true }),
    );
  });

  it("updateCategory rejects a category that doesn't exist in this tenant", async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await updateCategory({
      id: 'ghost-category',
      name: 'Drinks',
      sortOrder: 0,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such category/i),
    });
    expect(docUpdate).not.toHaveBeenCalled();
  });

  it('updateCategory updates the name and sort order', async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    const result = await updateCategory({
      id: 'cat-1',
      name: 'Drinks Renamed',
      sortOrder: 1,
    });
    expect(result.ok).toBe(true);
    expect(docUpdate).toHaveBeenCalledWith({
      name: 'Drinks Renamed',
      sortOrder: 1,
    });
  });

  it('updateMenuItem rejects a non-existent item id', async () => {
    docGet
      .mockResolvedValueOnce({ exists: true }) // category check
      .mockResolvedValueOnce({ exists: false }); // item lookup
    const result = await updateMenuItem({
      id: 'ghost-item',
      categoryId: 'cat-1',
      name: 'Tea',
      price: 20,
      vegFlag: true,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such menu item/i),
    });
    expect(docUpdate).not.toHaveBeenCalled();
  });

  it("setMenuItemAvailability rejects an item that doesn't exist in this tenant", async () => {
    docGet.mockResolvedValueOnce({ exists: false });
    const result = await setMenuItemAvailability({
      id: 'ghost-item',
      available: true,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no such menu item/i),
    });
    expect(docUpdate).not.toHaveBeenCalled();
  });

  it('setMenuItemAvailability toggles availability and audits which direction', async () => {
    const result = await setMenuItemAvailability({
      id: 'item-1',
      available: false,
    });
    expect(result.ok).toBe(true);
    expect(docUpdate).toHaveBeenCalledWith({ available: false });
    expect(logAuditMock).toHaveBeenCalledWith(
      admin,
      'MENU_ITEM_DISABLED',
      'menuItem',
      'item-1',
      {},
    );
  });
});
