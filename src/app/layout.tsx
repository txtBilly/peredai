import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter, Space_Grotesk, IBM_Plex_Mono, Audiowide } from 'next/font/google';
import './globals.css';

// Yandex.Metrika counter id.
const YM_ID = 112094331;

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
  title: {
    default: 'Ten2Ten — аренда квартир без риелторов и комиссии в Москве и СПб',
    template: '%s — Ten2Ten',
  },
  description:
    'Ten2Ten — передача аренды напрямую между жильцами, без посредников и комиссии. Снять квартиру, комнату или студию в Москве и Санкт-Петербурге.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.json',
  applicationName: 'Ten2Ten',
  keywords: [
    'аренда квартир',
    'снять квартиру без посредников',
    'аренда без риелтора',
    'аренда без комиссии',
    'снять комнату',
    'снять студию',
    'аренда квартир Москва',
    'аренда квартир Санкт-Петербург',
    'Ten2Ten',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    siteName: 'Ten2Ten',
    title: 'Ten2Ten — аренда квартир без риелторов и комиссии',
    description:
      'Передача аренды напрямую между жильцами, без посредников и комиссии. Москва и Санкт-Петербург.',
    type: 'website',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ten2Ten — аренда квартир без риелторов и комиссии',
    description: 'Передача аренды напрямую между жильцами, без посредников. Москва и Санкт-Петербург.',
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
    <html lang="ru" className={`${inter.variable} ${grotesk.variable} ${plexMono.variable} ${logoFont.variable}`}>
      <body>
        {/* Yandex.Metrika — loaded on every page via the root layout. */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}', 'ym');
ym(${YM_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`}
        </Script>
        <noscript>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://mc.yandex.ru/watch/${YM_ID}`} style={{ position: 'absolute', left: '-9999px' }} alt="" />
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
