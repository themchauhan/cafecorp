'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  turnOffMfa,
} from './actions';

export function MfaPanel({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [enrollment, setEnrollment] = useState<{
    qrDataUrl: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEnroll() {
    setError(null);
    setLoading(true);
    const result = await beginMfaEnrollment();
    if (!result.ok) {
      setError(result.error);
    } else {
      setEnrollment(result.data);
    }
    setLoading(false);
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await confirmMfaEnrollment(code);
    if (!result.ok) {
      setError(result.error);
    } else {
      setEnabled(true);
      setEnrollment(null);
      setCode('');
    }
    setLoading(false);
  }

  async function handleTurnOff() {
    setError(null);
    setLoading(true);
    const result = await turnOffMfa();
    if (!result.ok) {
      setError(result.error);
    } else {
      setEnabled(false);
    }
    setLoading(false);
  }

  if (enabled) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Two-factor authentication is <strong>on</strong>. You&apos;ll be asked
          for a 6-digit code from your authenticator app on every login.
        </p>
        <button
          onClick={handleTurnOff}
          disabled={loading}
          className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Turn off
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (enrollment) {
    return (
      <form onSubmit={handleConfirm} className="flex flex-col gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Scan this with your authenticator app, then enter the 6-digit code it
          shows.
        </p>
        <Image
          src={enrollment.qrDataUrl}
          alt="TOTP QR code"
          width={200}
          height={200}
          unoptimized
        />
        <p className="text-xs text-zinc-500">
          Can&apos;t scan? Enter this key manually:{' '}
          <code>{enrollment.secret}</code>
        </p>
        <input
          type="text"
          inputMode="numeric"
          required
          autoFocus
          placeholder="6-digit code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="self-start rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {loading ? 'Verifying…' : 'Confirm'}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Two-factor authentication is <strong>off</strong>.
      </p>
      <button
        onClick={handleEnroll}
        disabled={loading}
        className="self-start rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? 'Starting…' : 'Set up two-factor authentication'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
