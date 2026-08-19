import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import ResetView from './ResetView';

// Server wrapper so the password-reset screen carries the regular top header
// (logo + nav). The form itself lives in ResetView (client).
export default function ResetPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  return (
    <div className="neo-page">
      <SiteHeader locale={locale} />
      <ResetView params={params} />
    </div>
  );
}
