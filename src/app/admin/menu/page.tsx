import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { CategoryForm } from './category-form';
import { CategoryTable } from './category-table';
import { ItemForm } from './item-form';
import { ItemTable } from './item-table';
import type { Category, MenuItem } from './types';

export default async function MenuPage() {
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

  const [categoriesSnap, itemsSnap] = await Promise.all([
    adminDb
      .collection(`tenants/${tenantId}/menuCategories`)
      .orderBy('sortOrder')
      .get(),
    adminDb.collection(`tenants/${tenantId}/menuItems`).get(),
  ]);

  const categories: Category[] = categoriesSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Category, 'id'>),
  }));
  const items: MenuItem[] = itemsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<MenuItem, 'id'>),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <CategoryTable categories={categories} />
        <CategoryForm />
      </section>

      <section className="flex flex-col gap-4 border-t border-[var(--border)] pt-8">
        <h2 className="text-2xl font-bold tracking-tight">Menu items</h2>
        <ItemTable items={items} categories={categories} />
        <ItemForm categories={categories} />
      </section>
    </main>
  );
}
