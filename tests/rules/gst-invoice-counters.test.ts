import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';

// GST legal-invoice-number counter (one doc per Indian financial
// year), src/app/orders/billing-actions.ts's addPayment transaction.
// Purely internal — the assigned number is already exposed via the
// (readable) order doc, so no client path ever needs this directly.
// Flat `allow read, write: if false`, same shape as
// ticket-counters.test.ts.
describe('firestore.rules: gstInvoiceCounters', () => {
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
        doc(context.firestore(), 'tenants/tenant-a/gstInvoiceCounters/2026-27'),
        { count: 3 },
      );
    });
  });

  it('rejects an unauthenticated read', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(unauthedDb, 'tenants/tenant-a/gstInvoiceCounters/2026-27')),
    );
  });

  it("rejects the tenant's own ADMIN reading it", async () => {
    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertFails(
      getDoc(doc(adminDb, 'tenants/tenant-a/gstInvoiceCounters/2026-27')),
    );
  });

  it('rejects even SUPER_ADMIN reading it via the client SDK', async () => {
    const superDb = testEnv
      .authenticatedContext('super-1', { role: 'SUPER_ADMIN' })
      .firestore();
    await assertFails(
      getDoc(doc(superDb, 'tenants/tenant-a/gstInvoiceCounters/2026-27')),
    );
  });

  it('rejects any client write, including from SUPER_ADMIN', async () => {
    const superDb = testEnv
      .authenticatedContext('super-1', { role: 'SUPER_ADMIN' })
      .firestore();
    await assertFails(
      setDoc(doc(superDb, 'tenants/tenant-a/gstInvoiceCounters/2027-28'), {
        count: 1,
      }),
    );
  });
});
