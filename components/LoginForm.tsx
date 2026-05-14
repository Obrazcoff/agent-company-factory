'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/../components/ui/button';

type Props = {
  googleEnabled: boolean;
};

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1-1.2 3-3.5 3-2.1 0-3.9-1.8-3.9-4s1.8-4 3.9-4c1.2 0 2 .5 2.5.9l1.9-1.9C16.5 6.7 14.5 6 12 6 7.6 6 4 9.6 4 14s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.7 0-.5-.1-1.1-.2-1.6H12z"
      />
      <path
        fill="#4285F4"
        d="M4.3 7.7C3.5 9.1 3 10.7 3 12s.5 2.9 1.3 4.3l3.3-2.6C7.1 12.7 7 12.4 7 12s.1-.7.2-1.1L4.3 7.7z"
      />
      <path
        fill="#FBBC05"
        d="M12 21c2.4 0 4.5-.8 6-2.2l-3.3-2.6c-.8.5-1.9.8-2.7.8-2.1 0-3.9-1.4-4.5-3.3l-3.3 2.6C7.1 19.7 9.4 21 12 21z"
      />
      <path
        fill="#34A853"
        d="M21.6 12.2c0-.7-.1-1.4-.3-2H12v4h5.4c-.3 1.3-1.1 2.4-2.4 3.2l3.3 2.6c1.9-1.8 3.3-4.5 3.3-7.8z"
      />
    </svg>
  );
}

export function LoginForm({ googleEnabled }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Invalid email or password');
        return;
      }
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch {
      setError('Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 45% at 10% 0%, oklch(0.5 0.18 250), transparent 50%),
            radial-gradient(ellipse 50% 40% at 100% 30%, oklch(0.4 0.14 200), transparent 45%)
          `,
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-widest text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ← Back to landing
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">Welcome back</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Sign in to open the control plane.</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-6 shadow-[0_24px_80px_oklch(0.05_0.02_260/0.5)] backdrop-blur-md">
          {googleEnabled && (
            <>
              <button
                type="button"
                onClick={() => void onGoogle()}
                disabled={googleLoading || loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-fg)] py-2.5 text-sm font-medium text-[var(--color-bg)] transition hover:opacity-95 disabled:opacity-50"
              >
                <GoogleIcon />
                {googleLoading ? 'Redirecting…' : 'Continue with Google'}
              </button>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <span className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                  or email
                </span>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>
            </>
          )}

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-muted)]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/30 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-muted)]">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/30 focus:ring-2"
              />
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            <Button type="submit" disabled={loading || googleLoading} className="w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
            No account?{' '}
            <Link href="/register" className="font-medium text-[var(--color-accent)] hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
