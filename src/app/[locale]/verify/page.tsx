import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import VerifyView from './VerifyView';

// Server wrapper so the verify screen carries the regular top header (logo +
// nav). The interactive flow itself lives in VerifyView (client).
export default function VerifyPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string; return?: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  return (
    <div className="neo-page">
      <SiteHeader locale={locale} />
      <VerifyView params={params} searchParams={searchParams} />
    </div>
  );
}
