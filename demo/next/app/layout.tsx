import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { THEME_INIT_SCRIPT } from '@glyphnav-demo/shared';
import '@glyphnav-demo/shared/styles.css';
import { Shell } from './Shell';

export const viewport: Viewport = { themeColor: '#ffffff' };

export const metadata: Metadata = {
  title: 'glyphnav — next',
  description:
    'glyphnav for Next.js (App Router): GlyphnavLink and useGlyphnavNavigate animate the destination URL in the address bar. Live, interactive demo.',
  alternates: { canonical: 'https://z1m1n.github.io/glyphnav/next/' },
  icons: { icon: 'https://z1m1n.github.io/glyphnav/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'glyphnav',
    title: 'glyphnav — Next.js demo',
    description:
      'GlyphnavLink and useGlyphnavNavigate animate the destination URL in the address bar on Next.js App Router navigation.',
    url: 'https://z1m1n.github.io/glyphnav/next/',
    images: [
      {
        url: 'https://z1m1n.github.io/glyphnav/og.png',
        width: 1200,
        height: 630,
        alt: 'glyphnav — animated address-bar navigation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'glyphnav — Next.js demo',
    description:
      'GlyphnavLink and useGlyphnavNavigate animate the destination URL in the address bar on Next.js App Router navigation.',
    images: ['https://z1m1n.github.io/glyphnav/og.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script sets data-theme on <html>
    // before React hydrates, which would otherwise trip an attribute mismatch.
    <html lang="en" suppressHydrationWarning>
      <body data-fw="next">
        {/* Apply the saved/OS theme before first paint, so no flash. First in
            <body> so it runs before the app markup is parsed. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
