import { DEFAULT_LOCALE, type Locale } from './constants';

/** Первый язык из Accept-Language: ru* → ru, иначе en по умолчанию. */
export function negotiateFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header?.trim()) return DEFAULT_LOCALE;
  for (const part of header.split(',')) {
    const tag = part.trim().split(';')[0]?.trim().toLowerCase() ?? '';
    if (!tag) continue;
    if (tag.startsWith('ru')) return 'ru';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}
