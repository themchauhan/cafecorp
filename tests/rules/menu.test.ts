import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Phase 2: menuCategories, menuItems — readable by any tenant member
// (STAFF need these in Phase 3 to take orders), writes always denied
// since menu management goes through ADMIN-only Server Actions.
describe('firestore.rules: menu', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'cafeteria-management-rules-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'tenants/tenant-a/menuCategories/cat-1'), {
        name: 'Beverages',
        sortOrder: 0,
      });
      await setDoc(doc(db, 'tenants/tenant-a/menuItems/item-1'), {
        categoryId: 'cat-1',
        name: 'Tea',
        price: 20,
        vegFlag: true,
        available: true,
        description: '',
      });
    });
  });

  it('rejects an unauthenticated read', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(unauthedDb, 'tenants/tenant-a/menuItems/item-1')),
    );
  });

  it("lets STAFF (not just ADMIN) read the tenant's menu", async () => {
    const staffDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertSucceeds(
      getDoc(doc(staffDb, 'tenants/tenant-a/menuCategories/cat-1')),
    );
    await assertSucceeds(
      getDoc(doc(staffDb, 'tenants/tenant-a/menuItems/item-1')),
    );
  });

  it("rejects a user from Tenant B reading Tenant A's menu", async () => {
    const otherDb = testEnv
      .authenticatedContext('staff-b', { tenantId: 'tenant-b', role: 'STAFF' })
      .firestore();
    await assertFails(
      getDoc(doc(otherDb, 'tenants/tenant-a/menuItems/item-1')),
    );
  });

  it("rejects any client write, even from the tenant's own ADMIN", async () => {
    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertFails(
      setDoc(doc(adminDb, 'tenants/tenant-a/menuItems/item-1'), { price: 999 }),
    );
    await assertFails(
      setDoc(doc(adminDb, 'tenants/tenant-a/menuCategories/cat-2'), {
        name: 'Hacked',
        sortOrder: 0,
      }),
    );
  });
});
