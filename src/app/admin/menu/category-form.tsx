'use client';

import { useState, type FormEvent } from 'react';
import { createCategory } from './actions';

export function CategoryForm() {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createCategory({ name, sortOrder: Number(sortOrder) });
    if (!result.ok) {
      setError(result.error);
    } else {
      setName('');
      setSortOrder('0');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input
        type="text"
        required
        placeholder="Category name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="number"
        required
        placeholder="Sort order"
        value={sortOrder}
        onChange={(event) => setSortOrder(event.target.value)}
        className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? 'Adding…' : 'Add category'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
