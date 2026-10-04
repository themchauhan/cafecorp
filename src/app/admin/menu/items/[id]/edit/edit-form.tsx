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
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-6">
      <select
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        className="input"
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
        className="input"
      />
      <input
        type="number"
        required
        min="0"
        step="0.01"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        className="input"
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
        placeholder="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className="input"
      />
      {error && (
        <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary self-start"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
