'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/../components/ui/button';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { LanguageSwitcher } from '@/../components/i18n/LanguageSwitcher';

type Props = {
  googleEnabled: boolean;
};

/** Официальная многоцветная «G» (viewBox 24×24), не ужимать ниже ~20px — иначе мылится. */
function GoogleIcon() {
  return (
    <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginForm({ googleEnabled }: Props) {
  const { t } = useI18n();
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
        setError(t('login.errInvalid'));
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
      setError(t('login.errGoogle'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-16 sm:px-8 sm:py-20 md:py-28">
      <div className="absolute right-5 top-5 z-20 sm:right-8">
        <LanguageSwitcher />
      </div>
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
      <div className="relative z-10 mx-auto w-full max-w-lg md:max-w-xl">
        <div className="mb-10 text-center md:mb-12">
          <Link
            href="/"
            className="text-sm font-medium uppercase tracking-widest text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            {t('login.back')}
          </Link>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-[var(--color-fg)] md:mt-10 md:text-4xl">
            {t('login.title')}
          </h1>
          <p className="mt-3 text-base text-[var(--color-muted)] md:text-lg">{t('login.sub')}</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-8 shadow-[0_24px_80px_oklch(0.05_0.02_260/0.5)] backdrop-blur-md md:p-10">
          {googleEnabled && (
            <>
              <button
                type="button"
                onClick={() => void onGoogle()}
                disabled={googleLoading || loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-fg)] px-4 py-3.5 text-base font-medium text-[var(--color-bg)] transition hover:opacity-95 disabled:opacity-50 md:py-4 md:text-[1.05rem]"
              >
                <GoogleIcon />
                {googleLoading ? t('login.googleRedirect') : t('login.google')}
              </button>
              <div className="my-8 flex items-center gap-4 md:my-9">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)] md:text-sm">
                  {t('login.orEmail')}
                </span>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>
            </>
          )}

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-5 md:space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-muted)] md:text-base">
                {t('login.email')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3.5 text-base text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/30 focus:ring-2 md:py-4 md:text-lg"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-muted)] md:text-base">
                {t('login.password')}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3.5 text-base text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/30 focus:ring-2 md:py-4 md:text-lg"
              />
            </div>
            {error && <p className="text-base text-[var(--color-danger)]">{error}</p>}
            <Button
              type="submit"
              disabled={loading || googleLoading}
              className="h-12 w-full text-base md:h-14 md:text-lg"
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </Button>
          </form>

          <p className="mt-8 text-center text-base text-[var(--color-muted)] md:mt-10 md:text-lg">
            {t('login.noAccount')}{' '}
            <Link href="/register" className="font-semibold text-[var(--color-accent)] hover:underline">
              {t('login.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
