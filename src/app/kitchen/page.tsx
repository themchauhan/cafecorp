import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { AuthError, getSessionProfile, requireRole } from '@/lib/auth/session';
import { KitchenBoard } from './kitchen-board';

export default async function KitchenPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  try {
    requireRole(profile, ['ADMIN', 'STAFF']);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  if (!profile.tenantId) {
    return <Forbidden message="No tenant on this account" />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Kitchen &mdash; current tickets
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        On-screen fallback for cafes without a receipt printer. Updates live.
      </p>
      <KitchenBoard tenantId={profile.tenantId} />
    </main>
  );
}
