import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import ReportView from './ReportView';

export default function ReportPage({ params }: { params: { locale: string; id: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  return (
    <>
      <SiteHeader locale={locale} />
      <ReportView locale={locale} chatId={params.id} />
    </>
  );
}
