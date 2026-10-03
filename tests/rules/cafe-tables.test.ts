import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Phase 5: cafeTables — readable by any tenant member (STAFF need
// these for order creation and the table-status board), writes
// always denied.
describe('firestore.rules: cafeTables', () => {
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
      await setDoc(
        doc(context.firestore(), 'tenants/tenant-a/cafeTables/table-1'),
        {
          label: 'Table 1',
          active: true,
        },
      );
    });
  });

  it('rejects an unauthenticated read', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(unauthedDb, 'tenants/tenant-a/cafeTables/table-1')),
    );
  });

  it('lets STAFF read a table in their own tenant', async () => {
    const staffDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertSucceeds(
      getDoc(doc(staffDb, 'tenants/tenant-a/cafeTables/table-1')),
    );
  });

  it("rejects a user from Tenant B reading Tenant A's table", async () => {
    const otherDb = testEnv
      .authenticatedContext('staff-b', { tenantId: 'tenant-b', role: 'STAFF' })
      .firestore();
    await assertFails(
      getDoc(doc(otherDb, 'tenants/tenant-a/cafeTables/table-1')),
    );
  });

  it("rejects any client write, even from the tenant's own ADMIN", async () => {
    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertFails(
      setDoc(doc(adminDb, 'tenants/tenant-a/cafeTables/table-2'), {
        label: 'Table 2',
        active: true,
      }),
    );
  });
});
