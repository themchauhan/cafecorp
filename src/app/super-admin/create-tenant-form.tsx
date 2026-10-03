'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createTenant } from './actions';

export function CreateTenantForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<'TRIAL' | 'PAID'>('TRIAL');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createTenant({ name, phone, email, plan });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/super-admin/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input
        type="text"
        required
        placeholder="Cafe name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="tel"
        required
        placeholder="Phone"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="email"
        required
        placeholder="Owner email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        value={plan}
        onChange={(event) => setPlan(event.target.value as 'TRIAL' | 'PAID')}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="TRIAL">Trial (14 days)</option>
        <option value="PAID">Paid</option>
      </select>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? 'Creating…' : 'Create tenant'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
