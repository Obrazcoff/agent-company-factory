'use client';

import Link from 'next/link';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { LanguageSwitcher } from '@/../components/i18n/LanguageSwitcher';

export function MarketingLanding() {
  const { t } = useI18n();
  const features = [
    { titleKey: 'landing.feat1t' as const, descKey: 'landing.feat1d' as const },
    { titleKey: 'landing.feat2t' as const, descKey: 'landing.feat2d' as const },
    { titleKey: 'landing.feat3t' as const, descKey: 'landing.feat3d' as const },
  ];
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.22 0.04 260 / 0.9), oklch(0.14 0.03 260 / 0.95)),
            radial-gradient(ellipse 80% 50% at 20% -10%, oklch(0.55 0.2 250), transparent 55%),
            radial-gradient(ellipse 60% 40% at 90% 20%, oklch(0.45 0.18 200), transparent 50%),
            radial-gradient(ellipse 50% 35% at 50% 100%, oklch(0.35 0.12 280), transparent 45%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-[var(--color-fg)] hover:opacity-90"
        >
          {t('landing.brand')}
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-4">
          <LanguageSwitcher />
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
              {t('landing.signIn')}
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 font-medium text-black hover:opacity-90"
            >
              {t('landing.getStarted')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-16">
        <div className="max-w-2xl space-y-6">
          <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
            {t('landing.badge')}
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-[var(--color-fg)] md:text-5xl md:leading-[1.1]">
            {t('landing.headline')}
          </h1>
          <p className="text-base text-[var(--color-muted)] md:text-lg">{t('landing.sub')}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-black shadow-[0_0_24px_oklch(0.65_0.15_220/0.35)] hover:opacity-95"
            >
              {t('landing.tryConsole')}
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
            >
              {t('landing.createAccount')}
            </Link>
          </div>
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-3">
          {features.map((x) => (
            <li
              key={x.titleKey}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 backdrop-blur-sm"
            >
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">{t(x.titleKey)}</h2>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">{t(x.descKey)}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
