import { notFound, redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { EditCategoryForm } from './edit-form';
import type { Category } from '../../../types';

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const snap = await adminDb
    .doc(`tenants/${tenantId}/menuCategories/${id}`)
    .get();
  if (!snap.exists) {
    notFound();
  }
  const category: Category = {
    id: snap.id,
    ...(snap.data() as Omit<Category, 'id'>),
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Edit category</h1>
      <EditCategoryForm category={category} />
    </main>
  );
}
