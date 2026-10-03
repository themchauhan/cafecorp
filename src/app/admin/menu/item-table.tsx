'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { setMenuItemAvailability } from './actions';
import type { Category, MenuItem } from './types';

export function ItemTable({
  items,
  categories,
}: {
  items: MenuItem[];
  categories: Category[];
}) {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<
    'ALL' | 'AVAILABLE' | 'UNAVAILABLE'
  >('ALL');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const categoryName = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const filtered = items.filter((item) => {
    if (categoryFilter !== 'ALL' && item.categoryId !== categoryFilter)
      return false;
    if (availabilityFilter === 'AVAILABLE' && !item.available) return false;
    if (availabilityFilter === 'UNAVAILABLE' && item.available) return false;
    return true;
  });

  function toggleAvailability(item: MenuItem) {
    setError(null);
    startTransition(async () => {
      const result = await setMenuItemAvailability({
        id: item.id,
        available: !item.available,
      });
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="ALL">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={availabilityFilter}
          onChange={(event) =>
            setAvailabilityFilter(
              event.target.value as typeof availabilityFilter,
            )
          }
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="ALL">All items</option>
          <option value="AVAILABLE">Available only</option>
          <option value="UNAVAILABLE">Unavailable only</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No items match.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 pr-4">Name</th>
              <th className="py-1 pr-4">Category</th>
              <th className="py-1 pr-4">Price</th>
              <th className="py-1 pr-4">Veg</th>
              <th className="py-1 pr-4">Available</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="py-2 pr-4">{item.name}</td>
                <td className="py-2 pr-4">
                  {categoryName.get(item.categoryId) ?? '—'}
                </td>
                <td className="py-2 pr-4">{item.price.toFixed(2)}</td>
                <td className="py-2 pr-4">
                  {item.vegFlag ? 'Veg' : 'Non-veg'}
                </td>
                <td className="py-2 pr-4">
                  <button
                    onClick={() => toggleAvailability(item)}
                    disabled={isPending}
                    className="underline underline-offset-4 disabled:opacity-50"
                  >
                    {item.available ? 'Available' : 'Unavailable'}
                  </button>
                </td>
                <td className="py-2">
                  <Link
                    href={`/admin/menu/items/${item.id}/edit`}
                    className="underline underline-offset-4"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
