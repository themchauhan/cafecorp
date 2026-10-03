import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getClientApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

const app = getClientApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Emulator connection is idempotent-guarded by this module-level flag
// since Next.js can re-evaluate this module across fast-refresh.
let emulatorsConnected = false;
if (
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' &&
  !emulatorsConnected
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  emulatorsConnected = true;
}

export { app, auth, db };
