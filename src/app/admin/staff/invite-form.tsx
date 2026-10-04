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
    emailSent: boolean;
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
      setInvited({
        email,
        resetLink: result.data.resetLink,
        emailSent: result.data.emailSent,
      });
      setEmail('');
      setName('');
    }
    setLoading(false);
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <h2 className="text-lg font-bold">Invite staff</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="input w-auto"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input w-auto"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as 'ADMIN' | 'STAFF')}
          className="input w-auto"
        >
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Inviting…' : 'Invite'}
        </button>
      </form>
      {error && (
        <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
      {invited && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--color-brand-50)] p-3 text-sm">
          <p className="mb-1 text-[var(--muted)]">
            Invited <strong data-testid="invited-email">{invited.email}</strong>
            .{' '}
            {invited.emailSent ? (
              <>
                An invite email has been sent to them. You can also share this
                one-time password-setup link directly:
              </>
            ) : (
              <>
                No email is sent automatically — share this one-time
                password-setup link with them directly:
              </>
            )}
          </p>
          <code className="break-all">{invited.resetLink}</code>
        </div>
      )}
    </div>
  );
}
