import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Phase 3: orders — readable by any tenant member (STAFF need this
// for the order-taking screen and the live kitchen board), writes
// always denied since billing/state-machine logic lives in Server
// Actions, not rules.
describe('firestore.rules: orders', () => {
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
      await setDoc(doc(db, 'tenants/tenant-a/orders/order-1'), {
        orderType: 'TAKEAWAY',
        tableId: null,
        status: 'KOT_SENT',
        items: [
          {
            menuItemId: 'item-1',
            name: 'Tea',
            quantity: 1,
            priceSnapshot: 20,
            notes: '',
          },
        ],
        payments: [],
        cancelReason: null,
        createdBy: 'staff-a',
      });
    });
  });

  it('rejects an unauthenticated read', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(unauthedDb, 'tenants/tenant-a/orders/order-1')),
    );
  });

  it('lets STAFF read an order in their own tenant', async () => {
    const staffDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertSucceeds(
      getDoc(doc(staffDb, 'tenants/tenant-a/orders/order-1')),
    );
  });

  it("rejects a user from Tenant B reading Tenant A's order", async () => {
    const otherDb = testEnv
      .authenticatedContext('staff-b', { tenantId: 'tenant-b', role: 'STAFF' })
      .firestore();
    await assertFails(getDoc(doc(otherDb, 'tenants/tenant-a/orders/order-1')));
  });

  it('rejects any client write, even to create a new order', async () => {
    const staffDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertFails(
      setDoc(doc(staffDb, 'tenants/tenant-a/orders/order-2'), {
        orderType: 'TAKEAWAY',
        status: 'OPEN',
        items: [],
      }),
    );
    await assertFails(
      setDoc(doc(staffDb, 'tenants/tenant-a/orders/order-1'), {
        status: 'CANCELLED',
      }),
    );
  });
});
