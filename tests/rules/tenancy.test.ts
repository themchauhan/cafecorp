import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Phase 1b: tenants, profiles, auditLogs, platformAdmins. Covers
// CLAUDE.md's hard rule #9 (happy path + cross-tenant failure path
// for every feature) for the Phase 1b collections.
describe('firestore.rules: tenancy', () => {
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
      await setDoc(doc(db, 'tenants/tenant-a'), {
        name: 'Tenant A',
        status: 'ACTIVE',
      });
      await setDoc(doc(db, 'tenants/tenant-b'), {
        name: 'Tenant B',
        status: 'ACTIVE',
      });
      await setDoc(doc(db, 'tenants/tenant-a/profiles/admin-a'), {
        name: 'Admin A',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      await setDoc(doc(db, 'tenants/tenant-a/profiles/admin-a/private/mfa'), {
        secret: 'shh',
      });
      await setDoc(doc(db, 'tenants/tenant-a/auditLogs/log-1'), {
        action: 'test',
      });
      await setDoc(doc(db, 'platformAdmins/super-1'), { name: 'Super' });
      await setDoc(doc(db, 'platformAdmins/super-1/private/mfa'), {
        secret: 'shh',
      });
    });
  });

  it('rejects an unauthenticated read of a tenant doc', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthedDb, 'tenants/tenant-a')));
  });

  it('lets a tenant member read their own tenant doc', async () => {
    const memberDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'tenants/tenant-a')));
  });

  it("rejects a user from Tenant A reading Tenant B's doc", async () => {
    const memberDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertFails(getDoc(doc(memberDb, 'tenants/tenant-b')));
  });

  it("rejects a user from Tenant A reading Tenant B's profiles", async () => {
    const memberDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertFails(
      getDoc(doc(memberDb, 'tenants/tenant-b/profiles/admin-a')),
    );
  });

  it('lets SUPER_ADMIN read any tenant', async () => {
    const superDb = testEnv
      .authenticatedContext('super-1', { role: 'SUPER_ADMIN' })
      .firestore();
    await assertSucceeds(getDoc(doc(superDb, 'tenants/tenant-b')));
  });

  it('rejects any client write to a tenant doc, even from its own ADMIN', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertFails(
      setDoc(doc(adminDb, 'tenants/tenant-a'), { status: 'SUSPENDED' }),
    );
  });

  it('restricts auditLogs reads to ADMIN (not STAFF)', async () => {
    const staffDb = testEnv
      .authenticatedContext('staff-a', { tenantId: 'tenant-a', role: 'STAFF' })
      .firestore();
    await assertFails(getDoc(doc(staffDb, 'tenants/tenant-a/auditLogs/log-1')));

    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertSucceeds(
      getDoc(doc(adminDb, 'tenants/tenant-a/auditLogs/log-1')),
    );
  });

  it('never allows reading the MFA private doc, even for its own owner', async () => {
    const ownerDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertFails(
      getDoc(doc(ownerDb, 'tenants/tenant-a/profiles/admin-a/private/mfa')),
    );
  });

  it('rejects a non-SUPER_ADMIN reading platformAdmins', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin-a', { tenantId: 'tenant-a', role: 'ADMIN' })
      .firestore();
    await assertFails(getDoc(doc(adminDb, 'platformAdmins/super-1')));
  });

  it('lets a SUPER_ADMIN read their own platformAdmins doc', async () => {
    const superDb = testEnv
      .authenticatedContext('super-1', { role: 'SUPER_ADMIN' })
      .firestore();
    await assertSucceeds(getDoc(doc(superDb, 'platformAdmins/super-1')));
  });

  it("never allows reading a SUPER_ADMIN's MFA private doc, even for its own owner", async () => {
    const superDb = testEnv
      .authenticatedContext('super-1', { role: 'SUPER_ADMIN' })
      .firestore();
    await assertFails(
      getDoc(doc(superDb, 'platformAdmins/super-1/private/mfa')),
    );
  });
});
