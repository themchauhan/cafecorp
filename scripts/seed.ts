/**
 * Dummy data for local dev against the Firebase emulator. Run with
 * `npm run seed` while `npm run emulators` is running (or let
 * `npm run dev:seeded` start both). Safe to re-run — it overwrites
 * the same fixed ids.
 */
import { getEmulatorAdminApp } from './lib/emulator-admin';

const TENANT_ID = 'demo-cafe';
// A second, mostly-empty tenant dedicated to the e2e test that
// suspends/reactivates a tenant, so it never touches demo-cafe's
// shared accounts.
const LOCKOUT_TENANT_ID = 'lockout-test-cafe';
// A third tenant dedicated to the tax-rate e2e test — it mutates a
// tenant-wide setting (Settings > Tax rate), which would otherwise
// race with any other test billing an order against demo-cafe
// concurrently in a different Playwright worker.
const TAX_TEST_TENANT_ID = 'tax-test-cafe';

type SeedUser = {
  uid: string;
  email: string;
  password: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';
  tenantId?: string;
};

const USERS: SeedUser[] = [
  {
    uid: 'seed-super-admin',
    email: 'super@cafecorp.app',
    password: 'password123',
    name: 'Platform Super Admin',
    role: 'SUPER_ADMIN',
  },
  {
    uid: 'seed-admin',
    email: 'admin@demo.cafe',
    password: 'password123',
    name: 'Demo Cafe Admin',
    role: 'ADMIN',
  },
  {
    uid: 'seed-staff',
    email: 'staff@demo.cafe',
    password: 'password123',
    name: 'Demo Cafe Staff',
    role: 'STAFF',
  },
  // Dedicated accounts for e2e tests that enroll MFA or toggle
  // activation status, so they don't disturb the accounts above
  // (shared by other, order-independent tests).
  {
    uid: 'seed-mfa-admin',
    email: 'mfa-admin@demo.cafe',
    password: 'password123',
    name: 'MFA Test Admin',
    role: 'ADMIN',
  },
  {
    uid: 'seed-target-staff',
    email: 'target-staff@demo.cafe',
    password: 'password123',
    name: 'Deactivation Target',
    role: 'STAFF',
  },
  {
    uid: 'seed-lockout-staff',
    email: 'staff@lockout-test.cafe',
    password: 'password123',
    name: 'Lockout Test Staff',
    role: 'STAFF',
    tenantId: LOCKOUT_TENANT_ID,
  },
  {
    uid: 'seed-tax-admin',
    email: 'admin@tax-test.cafe',
    password: 'password123',
    name: 'Tax Test Admin',
    role: 'ADMIN',
    tenantId: TAX_TEST_TENANT_ID,
  },
];

async function main() {
  const { adminAuth, adminDb } = getEmulatorAdminApp();

  for (const user of USERS) {
    await adminAuth
      .createUser({
        uid: user.uid,
        email: user.email,
        password: user.password,
        emailVerified: true,
        displayName: user.name,
      })
      .catch(async (error: { code?: string }) => {
        if (error.code === 'auth/uid-already-exists') {
          await adminAuth.updateUser(user.uid, {
            email: user.email,
            password: user.password,
          });
          return;
        }
        throw error;
      });

    const claims =
      user.role === 'SUPER_ADMIN'
        ? { role: user.role }
        : { role: user.role, tenantId: user.tenantId ?? TENANT_ID };
    await adminAuth.setCustomUserClaims(user.uid, claims);

    if (user.role === 'SUPER_ADMIN') {
      await adminDb.doc(`platformAdmins/${user.uid}`).set({ name: user.name });
    } else {
      const tenantId = user.tenantId ?? TENANT_ID;
      await adminDb.doc(`tenants/${tenantId}/profiles/${user.uid}`).set({
        name: user.name,
        role: user.role,
        status: 'ACTIVE',
      });
    }
  }

  // Reset any MFA enrollment left over from a previous e2e run so the
  // MFA test's "not yet enrolled" starting state is reproducible.
  await adminDb
    .doc(`tenants/${TENANT_ID}/profiles/seed-mfa-admin/private/mfa`)
    .delete();

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  await adminDb.doc(`tenants/${TENANT_ID}`).set({
    name: 'Demo Cafe',
    phone: '+91 90000 00000',
    email: 'owner@demo.cafe',
    status: 'ACTIVE',
    plan: 'TRIAL',
    trialEndsAt: trialEndsAt.toISOString(),
    subscriptionEndsAt: null,
  });

  // Mostly-empty tenant for the suspend/reactivate e2e test — no menu
  // or tables needed since that test only checks login/write blocking.
  await adminDb.doc(`tenants/${LOCKOUT_TENANT_ID}`).set({
    name: 'Lockout Test Cafe',
    phone: '+91 90000 00001',
    email: 'owner@lockout-test.cafe',
    status: 'ACTIVE',
    plan: 'TRIAL',
    trialEndsAt: trialEndsAt.toISOString(),
    subscriptionEndsAt: null,
  });

  // Dedicated tenant for the tax-rate e2e test (Phase 9) — needs its
  // own single menu item so it doesn't have to touch demo-cafe's
  // shared tax rate, which every other order-billing test implicitly
  // assumes is 0%.
  await adminDb.doc(`tenants/${TAX_TEST_TENANT_ID}`).set({
    name: 'Tax Test Cafe',
    phone: '+91 90000 00002',
    email: 'owner@tax-test.cafe',
    status: 'ACTIVE',
    plan: 'TRIAL',
    trialEndsAt: trialEndsAt.toISOString(),
    subscriptionEndsAt: null,
  });
  await adminDb
    .doc(`tenants/${TAX_TEST_TENANT_ID}/menuCategories/cat-snacks`)
    .set({ name: 'Snacks', sortOrder: 0 });
  await adminDb.doc(`tenants/${TAX_TEST_TENANT_ID}/menuItems/item-samosa`).set({
    categoryId: 'cat-snacks',
    name: 'Samosa',
    price: 15,
    vegFlag: true,
    available: true,
    description: 'Two pieces',
  });

  // Dummy menu (Phase 2) — fixed ids so this script stays idempotent.
  const categories = [
    { id: 'cat-beverages', name: 'Beverages', sortOrder: 0 },
    { id: 'cat-snacks', name: 'Snacks', sortOrder: 1 },
  ];
  for (const category of categories) {
    await adminDb
      .doc(`tenants/${TENANT_ID}/menuCategories/${category.id}`)
      .set({ name: category.name, sortOrder: category.sortOrder });
  }

  const items = [
    {
      id: 'item-tea',
      categoryId: 'cat-beverages',
      name: 'Masala Chai',
      price: 20,
      vegFlag: true,
      available: true,
      description: '',
    },
    {
      id: 'item-coffee',
      categoryId: 'cat-beverages',
      name: 'Filter Coffee',
      price: 25,
      vegFlag: true,
      available: true,
      description: '',
    },
    {
      id: 'item-samosa',
      categoryId: 'cat-snacks',
      name: 'Samosa',
      price: 15,
      vegFlag: true,
      available: true,
      description: 'Two pieces',
    },
  ];
  for (const item of items) {
    const { id, ...data } = item;
    await adminDb.doc(`tenants/${TENANT_ID}/menuItems/${id}`).set(data);
  }

  // Dummy tables (Phase 5) — fixed ids so this script stays idempotent.
  // T3 is dedicated to the e2e test that toggles active/inactive, so
  // it doesn't race with the occupancy test using T1/T2.
  const tables = [
    { id: 'table-1', label: 'T1', active: true },
    { id: 'table-2', label: 'T2', active: true },
    { id: 'table-3', label: 'T3', active: true },
  ];
  for (const table of tables) {
    const { id, ...data } = table;
    await adminDb.doc(`tenants/${TENANT_ID}/cafeTables/${id}`).set(data);
  }

  console.log('Seeded:');
  console.log(`  Tenant: ${TENANT_ID}`);
  for (const user of USERS) {
    console.log(`  ${user.role.padEnd(12)} ${user.email} / ${user.password}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
