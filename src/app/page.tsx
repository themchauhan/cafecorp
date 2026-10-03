import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/session';

export default async function Home() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Signed in as <strong>{profile.role}</strong>
        {profile.tenantId ? ` · tenant ${profile.tenantId}` : ' · platform'}.
      </p>
    </main>
  );
}
