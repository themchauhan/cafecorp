import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { AuthError, getSessionProfile, requireRole } from '@/lib/auth/session';
import { isMfaEnabled } from '@/lib/auth/mfa';
import { MfaPanel } from './mfa-panel';

export default async function MfaPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  try {
    requireRole(profile, ['ADMIN', 'SUPER_ADMIN']);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const enabled = await isMfaEnabled(profile);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Two-factor authentication
      </h1>
      <MfaPanel initiallyEnabled={enabled} />
    </main>
  );
}
