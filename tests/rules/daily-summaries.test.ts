import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Phase 4: dailySummaries — revenue data, ADMIN/SUPER_ADMIN only
// (unlike menu/orders, which any tenant member can read). Written
// only by the billing Server Action.
describe('firestore.rules: dailySummaries', () => {
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
        doc(context.firestore(), 'tenants/tenant-a/dailySummaries/2026-10-03'),
        {
          totalsByMode: { CASH: 100 },
          totalsByStaff: { 'staff-a': 100 },
          itemsSold: {},
          categorySales: {},
        },
      );
    });
  });

  it('rejects an unauthenticated read', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(unauthedDb, 'tenants/tenant-a/dailySummaries/2026-10-03')),
    );
  });

  it('rejects STAFF reading revenue data (ADMIN only, unlike menu/orders)', async () => {
    const staffDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertFails(
      getDoc(doc(staffDb, 'tenants/tenant-a/dailySummaries/2026-10-03')),
    );
  });

  it("lets ADMIN read their own tenant's summary", async () => {
    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertSucceeds(
      getDoc(doc(adminDb, 'tenants/tenant-a/dailySummaries/2026-10-03')),
    );
  });

  it("rejects an ADMIN from Tenant B reading Tenant A's summary", async () => {
    const otherAdminDb = testEnv
      .authenticatedContext('admin-b', { tenantId: 'tenant-b', role: 'ADMIN' })
      .firestore();
    await assertFails(
      getDoc(doc(otherAdminDb, 'tenants/tenant-a/dailySummaries/2026-10-03')),
    );
  });

  it('rejects any client write, even from an ADMIN', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertFails(
      setDoc(doc(adminDb, 'tenants/tenant-a/dailySummaries/2026-10-03'), {
        totalsByMode: { CASH: 999999 },
      }),
    );
  });
});
