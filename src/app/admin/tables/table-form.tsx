'use client';

import { useState, type FormEvent } from 'react';
import { createTable } from './actions';

export function TableForm() {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createTable({ label });
    if (!result.ok) {
      setError(result.error);
    } else {
      setLabel('');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input
        type="text"
        required
        placeholder="Table label (e.g. T1)"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? 'Adding…' : 'Add table'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
