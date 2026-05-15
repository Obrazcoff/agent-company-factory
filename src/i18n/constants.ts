export const LOCALE_COOKIE = 'factory_locale';

export const LOCALES = ['en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(v: string | undefined): v is Locale {
  return v === 'en' || v === 'ru';
}
