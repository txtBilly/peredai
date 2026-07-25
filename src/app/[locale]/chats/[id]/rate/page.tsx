import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import RateView from './RateView';

export default function RatePage({ params }: { params: { locale: string; id: string } }) {
  if (!isLocale(params.locale)) notFound();
  return <RateView locale={params.locale as Locale} chatId={params.id} />;
}
