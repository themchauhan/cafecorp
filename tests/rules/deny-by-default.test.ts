import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Safety-net test for collections that don't have (and never will
// have) their own rules — uses a deliberately made-up collection name
// so this test file never needs to "move" again as real collections
// graduate to modeled (menuItems in Phase 2, orders in Phase 3,
// dailySummaries and cafeTables in Phase 4/5). Modeled collections
// are covered by their own dedicated rules test files instead.
describe('firestore.rules (deny by default for unmodeled collections)', () => {
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

  it('rejects an unauthenticated read of an unmodeled collection', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(unauthedDb, 'tenants/tenant-a/notARealCollection/doc-1')),
    );
  });

  it("rejects a tenant member's read of an unmodeled collection", async () => {
    const memberDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertFails(
      getDoc(doc(memberDb, 'tenants/tenant-a/notARealCollection/doc-1')),
    );
  });

  it('rejects a write from an authenticated user with no rule granting it', async () => {
    const userDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertFails(
      setDoc(doc(userDb, 'tenants/tenant-a/notARealCollection/doc-1'), {
        anything: true,
      }),
    );
  });
});
