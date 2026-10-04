'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { updateCategory } from '../../../actions';
import type { Category } from '../../../types';

export function EditCategoryForm({ category }: { category: Category }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateCategory({
      id: category.id,
      name,
      sortOrder: Number(sortOrder),
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
        value={sortOrder}
        onChange={(event) => setSortOrder(event.target.value)}
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
