import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/constants';
import { negotiateFromAcceptLanguage } from '@/i18n/negotiate';

/** For Route Handlers / tests: no `cookies()` from next/headers (needs request context). */
export function getLocaleFromRequest(request: Request): Locale {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const s = part.trim();
    if (!s.startsWith(`${LOCALE_COOKIE}=`)) continue;
    const raw = decodeURIComponent(s.slice(LOCALE_COOKIE.length + 1).trim());
    if (isLocale(raw)) return raw;
  }
  const al = request.headers.get('accept-language');
  return negotiateFromAcceptLanguage(al);
}
