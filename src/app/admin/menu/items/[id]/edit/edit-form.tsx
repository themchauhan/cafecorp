'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { updateMenuItem } from '../../../actions';
import type { Category, MenuItem } from '../../../types';

export function EditItemForm({
  item,
  categories,
}: {
  item: MenuItem;
  categories: Category[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [vegFlag, setVegFlag] = useState(item.vegFlag);
  const [description, setDescription] = useState(item.description);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateMenuItem({
      id: item.id,
      categoryId,
      name,
      price: Number(price),
      vegFlag,
      description,
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push('/admin/menu');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <select
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="number"
        required
        min="0"
        step="0.01"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <label className="flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          checked={vegFlag}
          onChange={(event) => setVegFlag(event.target.checked)}
        />
        Veg
      </label>
      <input
        type="text"
        placeholder="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="self-start rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
