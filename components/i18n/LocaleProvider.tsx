'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { LOCALE_COOKIE, type Locale } from '@/i18n/constants';
import { createTranslator, type Messages, type TranslateFn } from '@/i18n/dictionaries';

type I18nContextValue = {
  locale: Locale;
  t: TranslateFn;
  setLocale: (next: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const ONE_YEAR = 60 * 60 * 24 * 365;

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const router = useRouter();
  const t = useMemo(() => createTranslator(messages), [messages]);
  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${ONE_YEAR};SameSite=Lax`;
      router.refresh();
    },
    [router],
  );
  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const c = useContext(I18nContext);
  if (!c) throw new Error('useI18n must be used within LocaleProvider');
  return c;
}
