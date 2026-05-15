'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/../components/i18n/LocaleProvider';
import type { Locale } from '@/i18n/constants';
import type { Messages } from '@/i18n/dictionaries';

export function Providers({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
}) {
  return (
    <SessionProvider>
      <LocaleProvider locale={locale} messages={messages}>
        {children}
      </LocaleProvider>
    </SessionProvider>
  );
}
