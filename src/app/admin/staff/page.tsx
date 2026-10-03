import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { InviteForm } from './invite-form';
import { StaffList, type StaffRow } from './staff-list';

export default async function StaffPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  let tenantId: string;
  try {
    requireRole(profile, ['ADMIN']);
    tenantId = requireTenantId(profile);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const snap = await adminDb.collection(`tenants/${tenantId}/profiles`).get();
  const staff: StaffRow[] = await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data() as { name: string; role: string; status: string };
      const email = await adminAuth
        .getUser(doc.id)
        .then((user) => user.email ?? '')
        .catch(() => '');
      return { uid: doc.id, email, ...data } as StaffRow;
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
      <StaffList staff={staff} currentUid={profile.uid} />
      <InviteForm />
    </main>
  );
}
