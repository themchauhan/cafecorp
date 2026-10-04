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
    <form
      onSubmit={handleSubmit}
      className="card flex flex-wrap items-end gap-3 p-4"
    >
      <input
        type="text"
        required
        placeholder="Table label (e.g. T1)"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        className="input w-auto"
      />
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? 'Adding…' : 'Add table'}
      </button>
      {error && (
        <p className="w-full text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
    </form>
  );
}
