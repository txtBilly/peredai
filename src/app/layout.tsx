import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, IBM_Plex_Mono, Audiowide } from 'next/font/google';
import './globals.css';

// Neo-Classified type system: Inter (body), Space Grotesk (display/headings),
// IBM Plex Mono (meta labels), Orbitron (the ten2ten wordmark). Exposed as CSS
// variables the Tailwind theme maps to font-sans / font-display / font-mono /
// font-logo.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});
const logoFont = Audiowide({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-logo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ten2Ten — Find your next place',
  description:
    'A verified community where NYC renters pass apartments directly to each other. No brokers. $100 to connect.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'Ten2Ten — Find your next place',
    description:
      'A verified community where NYC renters pass apartments to each other. No brokers. $100 to connect.',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    title: 'Ten2Ten',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Root layout owns <html>/<body> (required by Next). Per-route sections
  // ([locale], /admin) are nested layouts and must not render them.
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${plexMono.variable} ${logoFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
