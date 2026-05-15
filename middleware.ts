import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/i18n/constants';
import { negotiateFromAcceptLanguage } from '@/i18n/negotiate';

const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest) {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(existing)) {
    return NextResponse.next();
  }
  const negotiated = negotiateFromAcceptLanguage(request.headers.get('accept-language'));
  const locale = isLocale(negotiated) ? negotiated : DEFAULT_LOCALE;
  const res = NextResponse.next();
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
  });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
