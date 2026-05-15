'use client';

import { useI18n } from '@/../components/i18n/LocaleProvider';
import type { Locale } from '@/i18n/constants';
import { cn } from '@/../lib/cn';

const LOCALES: Locale[] = ['en', 'ru'];

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={cn('inline-flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2', className)}
      role="group"
      aria-label={t('lang.label')}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] sm:text-xs">
        {t('lang.label')}
      </span>
      <div
        className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/90 p-0.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.04)] backdrop-blur-sm"
        role="presentation"
      >
        {LOCALES.map((code) => {
          const active = locale === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              aria-label={`${t('lang.label')}: ${code === 'en' ? t('lang.en') : t('lang.ru')}`}
              onClick={() => {
                if (locale !== code) setLocale(code);
              }}
              className={cn(
                'relative min-w-[2.75rem] rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
                active
                  ? 'bg-[var(--color-accent)] text-black shadow-[0_1px_8px_oklch(0.65_0.15_220/0.35)]'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
              )}
            >
              {code === 'en' ? t('lang.en') : t('lang.ru')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
