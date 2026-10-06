'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [idToken, setIdToken] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSession(token: string, code?: string) {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, totpCode: code }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (body.error === 'MFA_REQUIRED') {
        setIdToken(token);
        setMfaRequired(true);
        return;
      }
      throw new Error(body.error ?? 'Login failed');
    }
    router.push('/');
    router.refresh();
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const token = await credential.user.getIdToken();
      await startSession(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent) {
    event.preventDefault();
    if (!idToken) return;
    setError(null);
    setLoading(true);
    try {
      await startSession(idToken, totpCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  if (mfaRequired) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
        <div className="card flex flex-col gap-4 p-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-mark.svg"
              alt=""
              width={32}
              height={32}
              className="rounded-lg"
            />
            <div>
              <p className="text-lg font-bold text-[var(--color-brand-600)]">
                CafeCorp
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                Authenticator code
              </h1>
            </div>
          </div>
          <form onSubmit={handleMfaSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              required
              autoFocus
              placeholder="6-digit code"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              className="input text-center text-lg tracking-widest"
            />
            {error && (
              <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
      <div className="card flex flex-col gap-4 p-8">
        <div className="flex items-center gap-2">
          <Image
            src="/logo-mark.svg"
            alt=""
            width={32}
            height={32}
            className="rounded-lg"
          />
          <div>
            <p className="text-lg font-bold text-[var(--color-brand-600)]">
              CafeCorp
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          </div>
        </div>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
          />
          {error && (
            <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
