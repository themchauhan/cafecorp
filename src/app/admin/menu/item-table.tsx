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
      <div className="flex flex-wrap gap-2">
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="input w-auto"
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
          className="input w-auto"
        >
          <option value="ALL">All items</option>
          <option value="AVAILABLE">Available only</option>
          <option value="UNAVAILABLE">Unavailable only</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
      )}

      {filtered.length === 0 ? (
        <p className="card p-6 text-sm text-[var(--muted)]">No items match.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 pr-4 font-semibold">Name</th>
                <th className="px-4 py-3 pr-4 font-semibold">Category</th>
                <th className="px-4 py-3 pr-4 font-semibold">Price</th>
                <th className="px-4 py-3 pr-4 font-semibold">Veg</th>
                <th className="px-4 py-3 pr-4 font-semibold">Available</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 pr-4 font-medium">{item.name}</td>
                  <td className="px-4 py-3 pr-4">
                    {categoryName.get(item.categoryId) ?? '—'}
                  </td>
                  <td className="px-4 py-3 pr-4">{item.price.toFixed(2)}</td>
                  <td className="px-4 py-3 pr-4">
                    {item.vegFlag ? 'Veg' : 'Non-veg'}
                  </td>
                  <td className="px-4 py-3 pr-4">
                    <button
                      onClick={() => toggleAvailability(item)}
                      disabled={isPending}
                      className={`text-sm font-semibold hover:underline disabled:opacity-50 ${
                        item.available
                          ? 'text-[var(--color-success-600)]'
                          : 'text-[var(--color-danger-600)]'
                      }`}
                    >
                      {item.available ? 'Available' : 'Unavailable'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/menu/items/${item.id}/edit`}
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
      )}
    </div>
  );
}
