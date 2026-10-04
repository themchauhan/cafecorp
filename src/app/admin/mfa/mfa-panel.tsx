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
        <p className="text-sm text-[var(--muted)]">
          Two-factor authentication is{' '}
          <strong className="text-[var(--foreground)]">on</strong>. You&apos;ll
          be asked for a 6-digit code from your authenticator app on every
          login.
        </p>
        <button
          onClick={handleTurnOff}
          disabled={loading}
          className="btn btn-danger self-start"
        >
          Turn off
        </button>
        {error && (
          <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
        )}
      </div>
    );
  }

  if (enrollment) {
    return (
      <form onSubmit={handleConfirm} className="flex flex-col gap-3">
        <p className="text-sm text-[var(--muted)]">
          Scan this with your authenticator app, then enter the 6-digit code it
          shows.
        </p>
        <Image
          src={enrollment.qrDataUrl}
          alt="TOTP QR code"
          width={200}
          height={200}
          unoptimized
          className="rounded-xl border border-[var(--border)]"
        />
        <p className="text-xs text-[var(--muted)]">
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
          className="input text-center text-lg tracking-widest"
        />
        {error && (
          <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary self-start"
        >
          {loading ? 'Verifying…' : 'Confirm'}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">
        Two-factor authentication is{' '}
        <strong className="text-[var(--foreground)]">off</strong>.
      </p>
      <button
        onClick={handleEnroll}
        disabled={loading}
        className="btn btn-primary self-start"
      >
        {loading ? 'Starting…' : 'Set up two-factor authentication'}
      </button>
      {error && (
        <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
    </div>
  );
}
