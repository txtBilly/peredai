import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import ReportView from './ReportView';

export default function ReportPage({ params }: { params: { locale: string; id: string } }) {
  if (!isLocale(params.locale)) notFound();
  return <ReportView locale={params.locale as Locale} chatId={params.id} />;
}
