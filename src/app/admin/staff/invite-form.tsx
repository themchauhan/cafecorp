'use client';

import { useState, type FormEvent } from 'react';
import { inviteStaff } from './actions';

export function InviteForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'STAFF'>('STAFF');
  const [invited, setInvited] = useState<{
    email: string;
    resetLink: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInvited(null);
    setLoading(true);
    const result = await inviteStaff({ email, name, role });
    if (!result.ok) {
      setError(result.error);
    } else {
      setInvited({ email, resetLink: result.data.resetLink });
      setEmail('');
      setName('');
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-medium">Invite staff</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as 'ADMIN' | 'STAFF')}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {loading ? 'Inviting…' : 'Invite'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {invited && (
        <div className="rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
          <p className="mb-1 text-zinc-600 dark:text-zinc-400">
            Invited <strong data-testid="invited-email">{invited.email}</strong>
            . No email is sent automatically — share this one-time
            password-setup link with them directly:
          </p>
          <code className="break-all">{invited.resetLink}</code>
        </div>
      )}
    </div>
  );
}
