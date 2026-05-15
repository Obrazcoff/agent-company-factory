'use client';

import { useI18n } from '@/../components/i18n/LocaleProvider';
import type { Locale } from '@/i18n/constants';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  function pill(code: Locale, label: string) {
    return (
      <button
        key={code}
        type="button"
        aria-pressed={locale === code}
        aria-label={`${t('lang.label')}: ${label}`}
        onClick={() => {
          if (locale !== code) setLocale(code);
        }}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
          locale === code
            ? 'bg-[var(--color-accent)] text-black'
            : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]'
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className={className} role="group" aria-label={t('lang.label')}>
      <span className="mr-1.5 text-xs text-[var(--color-muted)]">{t('lang.label')}:</span>
      {pill('en', t('lang.en'))}
      {pill('ru', t('lang.ru'))}
    </div>
  );
}
