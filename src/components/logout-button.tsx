'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    // Both halves matter: the server session cookie (gates SSR pages)
    // and the client SDK's own session (gates client-side Firestore
    // reads, e.g. the Phase 3 kitchen board's onSnapshot query) — a
    // stale client session would otherwise keep reading live data
    // after the user believes they've logged out.
    await Promise.all([
      fetch('/api/session', { method: 'DELETE' }),
      signOut(auth),
    ]);
    router.push('/login');
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="btn btn-sm btn-secondary">
      Log out
    </button>
  );
}
