/**
 * One-time CLI to provision a SUPER_ADMIN. Never a public signup
 * route (CLAUDE.md / phase-1c). Run with:
 *
 *   npx tsx scripts/provision-super-admin.ts --email you@example.com --name "Your Name"
 *
 * Targets the Firebase emulator when NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
 * is set (e.g. via `--env-file=.env.local`); otherwise targets the real
 * project using FIREBASE_ADMIN_* env vars and asks for confirmation
 * before writing, since this grants platform-wide access.
 */
import { parseArgs } from 'node:util';
import * as readline from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getEmulatorAdminApp } from './lib/emulator-admin';

const argsSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

function getRealAdminApp() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n',
  );
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY. Pass ' +
        '--env-file=.env.production.local (or similar) with real Admin SDK credentials.',
    );
  }
  const app =
    getApps()[0] ??
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return { app, adminAuth: getAuth(app), adminDb: getFirestore(app) };
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(`${message} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      yes: { type: 'boolean', default: false },
    },
  });
  const { email, name } = argsSchema.parse(values);

  const usingEmulator =
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
  if (!usingEmulator && !values.yes) {
    const ok = await confirm(
      `This will grant SUPER_ADMIN (full platform access) to ${email} on a REAL Firebase project. Continue?`,
    );
    if (!ok) {
      console.log('Aborted.');
      return;
    }
  }

  const { adminAuth, adminDb } = usingEmulator
    ? getEmulatorAdminApp()
    : getRealAdminApp();

  let uid: string;
  let temporaryPassword: string | null = null;
  try {
    uid = (await adminAuth.getUserByEmail(email)).uid;
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found')
      throw error;
    temporaryPassword = randomUUID();
    uid = (
      await adminAuth.createUser({
        email,
        password: temporaryPassword,
        displayName: name,
        emailVerified: true,
      })
    ).uid;
  }

  await adminAuth.setCustomUserClaims(uid, { role: 'SUPER_ADMIN' });
  await adminDb.doc(`platformAdmins/${uid}`).set({ name });

  console.log(`SUPER_ADMIN provisioned: ${email} (uid ${uid})`);
  if (temporaryPassword) {
    console.log(`Temporary password: ${temporaryPassword}`);
    console.log('Sign in once, then use "Forgot password" to set a real one.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
