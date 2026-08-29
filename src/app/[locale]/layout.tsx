import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, locales, defaultLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import OpenChatGate from '@/components/OpenChatGate';
import SiteFooter from '@/components/SiteFooter';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ten2ten.ru';

const META = {
  ru: {
    description:
      'Ten2Ten — передача аренды напрямую между жильцами, без риелторов и комиссии. ' +
      'Снять квартиру, комнату или студию в Москве и Санкт‑Петербурге от прежних жильцов.',
    keywords: [
      'аренда квартир',
      'снять квартиру без посредников',
      'аренда без риелтора',
      'аренда без комиссии',
      'снять комнату',
      'снять студию',
      'аренда квартир Москва',
      'аренда квартир Санкт‑Петербург',
      'передать аренду',
      'Ten2Ten',
    ],
  },
  en: {
    description:
      'Ten2Ten hands a rental straight from one tenant to the next — no realtors, no commission. ' +
      'Rent apartments, rooms and studios in Moscow and Saint Petersburg from previous tenants.',
    keywords: [
      'rent apartment Russia',
      'rent without agent',
      'no commission rental',
      'rent a room',
      'rent a studio',
      'Moscow apartments',
      'Saint Petersburg apartments',
      'Ten2Ten',
    ],
  },
} as const;

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale;
  const m = META[locale];
  return {
    description: m.description,
    keywords: [...m.keywords],
    alternates: {
      canonical: `/${locale}`,
      languages: { ru: '/ru', en: '/en', 'x-default': '/ru' },
    },
    openGraph: {
      description: m.description,
      url: `/${locale}`,
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
      type: 'website',
    },
  };
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  // Organization + WebSite structured data (helps search engines understand the
  // brand and enables a sitelinks search box). Listing-level RealEstateListing
  // markup will come once detail pages are server-rendered.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Ten2Ten',
      url: APP_URL,
      logo: `${APP_URL}/icon-512.png`,
      slogan: locale === 'ru' ? 'сам себе риелтор' : 'be your own realtor',
      areaServed: ['Москва', 'Санкт-Петербург'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Ten2Ten',
      url: `${APP_URL}/${locale}`,
      inLanguage: locale === 'ru' ? 'ru-RU' : 'en-US',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${APP_URL}/${locale}/browse?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <OpenChatGate locale={locale} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex-1">{children}</div>
      <SiteFooter locale={locale} />
    </div>
  );
}
