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
    <form
      onSubmit={handleSubmit}
      className="card flex flex-wrap items-end gap-3 p-4"
    >
      <input
        type="text"
        required
        placeholder="Category name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="input w-48"
      />
      <input
        type="number"
        required
        placeholder="Sort order"
        value={sortOrder}
        onChange={(event) => setSortOrder(event.target.value)}
        className="input w-28"
      />
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? 'Adding…' : 'Add category'}
      </button>
      {error && (
        <p className="w-full text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
    </form>
  );
}
