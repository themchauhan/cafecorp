import { notFound, redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { EditItemForm } from './edit-form';
import type { Category, MenuItem } from '../../../types';

export default async function EditItemPage({
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

  const [itemSnap, categoriesSnap] = await Promise.all([
    adminDb.doc(`tenants/${tenantId}/menuItems/${id}`).get(),
    adminDb
      .collection(`tenants/${tenantId}/menuCategories`)
      .orderBy('sortOrder')
      .get(),
  ]);
  if (!itemSnap.exists) {
    notFound();
  }
  const item: MenuItem = {
    id: itemSnap.id,
    ...(itemSnap.data() as Omit<MenuItem, 'id'>),
  };
  const categories: Category[] = categoriesSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Category, 'id'>),
  }));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Edit menu item</h1>
      <EditItemForm item={item} categories={categories} />
    </main>
  );
}
