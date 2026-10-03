/**
 * Admin SDK bootstrap for standalone scripts (seed, provisioning)
 * that must only ever target the Firebase emulator suite — never a
 * real project, so a misconfigured environment can't accidentally
 * write dummy data (or create a SUPER_ADMIN) in production
 * (CLAUDE.md rule #6: dummy data only in seeds/fixtures). The
 * emulator host env vars are force-set, not merely defaulted, so
 * nothing in the environment can point this at a real project.
 */
import { readFileSync } from 'node:fs';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function readDefaultProjectId(): string {
  const firebaserc = JSON.parse(readFileSync('.firebaserc', 'utf8')) as {
    projects?: { default?: string };
  };
  const projectId = firebaserc.projects?.default;
  if (!projectId) {
    throw new Error('No projects.default in .firebaserc');
  }
  return projectId;
}

export function getEmulatorAdminApp() {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

  const app =
    getApps()[0] ?? initializeApp({ projectId: readDefaultProjectId() });
  return { app, adminAuth: getAuth(app), adminDb: getFirestore(app) };
}
