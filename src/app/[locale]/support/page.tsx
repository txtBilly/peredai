import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import SiteHeader from '@/components/SiteHeader';
import SupportView from './SupportView';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const ru = params.locale !== 'en';
  return {
    title: ru ? 'Написать в поддержку' : 'Contact support',
    robots: { index: false, follow: false },
  };
}

export default async function SupportPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  // Signed-in members only — so we can attach their name/chat/listing to the message.
  await requireUser(locale);

  return (
    <>
      <SiteHeader locale={locale} />
      <SupportView locale={locale} />
    </>
  );
}
