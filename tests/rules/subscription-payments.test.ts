import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Phase 7: SUPER_ADMIN-only billing records for tenant subscriptions.
// No client path needs this at all — SUPER_ADMIN tooling reads/writes
// it only via the Admin SDK (super-admin/actions.ts), which bypasses
// these rules by design. The rule is a flat `allow read, write: if
// false`, so this confirms that holds even for the one role (SUPER_
// ADMIN) that can read everything else in the schema.
describe('firestore.rules: subscriptionPayments', () => {
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
      await setDoc(doc(context.firestore(), 'subscriptionPayments/payment-1'), {
        tenantId: 'tenant-a',
        amount: 999,
      });
    });
  });

  it('rejects an unauthenticated read', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(unauthedDb, 'subscriptionPayments/payment-1')),
    );
  });

  it("rejects the affected tenant's own ADMIN reading it", async () => {
    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertFails(getDoc(doc(adminDb, 'subscriptionPayments/payment-1')));
  });

  it('rejects even SUPER_ADMIN reading it via the client SDK', async () => {
    const superDb = testEnv
      .authenticatedContext('super-1', { role: 'SUPER_ADMIN' })
      .firestore();
    await assertFails(getDoc(doc(superDb, 'subscriptionPayments/payment-1')));
  });

  it('rejects any client write, including from SUPER_ADMIN', async () => {
    const superDb = testEnv
      .authenticatedContext('super-1', { role: 'SUPER_ADMIN' })
      .firestore();
    await assertFails(
      setDoc(doc(superDb, 'subscriptionPayments/payment-2'), {
        tenantId: 'tenant-a',
        amount: 1,
      }),
    );
  });
});
