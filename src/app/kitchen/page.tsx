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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Kitchen &mdash; current tickets
        </h1>
        <p className="text-sm text-[var(--muted)]">
          On-screen fallback for cafes without a receipt printer. Updates live.
        </p>
      </div>
      <KitchenBoard tenantId={profile.tenantId} />
    </main>
  );
}
