import { notFound } from 'next/navigation';
import { isLocale, locales } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import OpenChatGate from '@/components/OpenChatGate';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  return (
    <>
      <OpenChatGate locale={params.locale as Locale} />
      {children}
    </>
  );
}
