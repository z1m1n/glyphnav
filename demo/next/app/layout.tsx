import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import '@glyphnav-demo/shared/styles.css';
import { Shell } from './Shell';

export const metadata: Metadata = {
  title: 'glyphnav — next',
  description: 'Next.js (App Router) demo for glyphnav.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
