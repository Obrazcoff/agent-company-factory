import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Agent Company Factory — Control Plane',
  description: 'MVP control plane for autonomous agent companies',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
