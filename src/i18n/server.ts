import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/constants';
import { negotiateFromAcceptLanguage } from '@/i18n/negotiate';

export async function getLocale(): Promise<Locale> {
  const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(raw)) return raw;
  const al = (await headers()).get('accept-language');
  return negotiateFromAcceptLanguage(al);
}
