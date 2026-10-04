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
      <p className="card p-6 text-sm text-[var(--muted)]">
        Add a category first before adding menu items.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card flex flex-wrap items-end gap-3 p-4"
    >
      <select
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        className="input w-auto"
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
        className="input w-48"
      />
      <input
        type="number"
        required
        min="0"
        step="0.01"
        placeholder="Price"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        className="input w-28"
      />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={vegFlag}
          onChange={(event) => setVegFlag(event.target.checked)}
          className="h-4 w-4"
        />
        Veg
      </label>
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className="input w-56"
      />
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? 'Adding…' : 'Add item'}
      </button>
      {error && (
        <p className="w-full text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
    </form>
  );
}
