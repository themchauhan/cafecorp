import Link from 'next/link';
import type { Category } from './types';

export function CategoryTable({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No categories yet.
      </p>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-zinc-500 dark:text-zinc-400">
        <tr>
          <th className="py-1 pr-4">Name</th>
          <th className="py-1 pr-4">Sort order</th>
          <th className="py-1" />
        </tr>
      </thead>
      <tbody>
        {categories.map((category) => (
          <tr
            key={category.id}
            className="border-t border-zinc-200 dark:border-zinc-800"
          >
            <td className="py-2 pr-4">{category.name}</td>
            <td className="py-2 pr-4">{category.sortOrder}</td>
            <td className="py-2">
              <Link
                href={`/admin/menu/categories/${category.id}/edit`}
                className="text-sm underline underline-offset-4"
              >
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
