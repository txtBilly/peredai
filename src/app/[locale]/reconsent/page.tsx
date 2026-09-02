import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import ReconsentView from './ReconsentView';

// Re-consent screen. Members created against an older consent version are routed
// here by the middleware when the legal documents change materially. Not indexable.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ReconsentPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  return (
    <div className="neo-page">
      <SiteHeader locale={locale} />
      <ReconsentView params={params} />
    </div>
  );
}
