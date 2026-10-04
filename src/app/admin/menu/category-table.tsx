import Link from 'next/link';
import type { Category } from './types';

export function CategoryTable({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <p className="card p-6 text-sm text-[var(--muted)]">No categories yet.</p>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 pr-4 font-semibold">Name</th>
            <th className="px-4 py-3 pr-4 font-semibold">Sort order</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id} className="border-t border-[var(--border)]">
              <td className="px-4 py-3 pr-4 font-medium">{category.name}</td>
              <td className="px-4 py-3 pr-4">{category.sortOrder}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/menu/categories/${category.id}/edit`}
                  className="font-semibold text-[var(--color-brand-600)] hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
