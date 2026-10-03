'use client';

import { useState, type FormEvent } from 'react';
import { createMenuItem } from './actions';
import type { Category } from './types';

export function ItemForm({ categories }: { categories: Category[] }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [vegFlag, setVegFlag] = useState(true);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createMenuItem({
      categoryId,
      name,
      price: Number(price),
      vegFlag,
      description,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setName('');
      setPrice('');
      setDescription('');
    }
    setLoading(false);
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Add a category first before adding menu items.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <select
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
        placeholder="Item name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="number"
        required
        min="0"
        step="0.01"
        placeholder="Price"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
        placeholder="Description (optional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? 'Adding…' : 'Add item'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
