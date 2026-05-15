import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';
import { getLocale } from '@/i18n/server';
import { getDictionary } from '@/i18n/dictionaries';

export const metadata = {
  title: 'Agent Company Factory — Control Plane',
  description: 'MVP control plane for autonomous agent companies',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = getDictionary(locale);
  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
