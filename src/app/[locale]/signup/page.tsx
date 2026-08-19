import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import SignUpView from './SignUpView';

// Server wrapper so the sign-up screen carries the regular top header (logo +
// nav). The form itself lives in SignUpView (client).
export default function SignUpPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  return (
    <div className="neo-page">
      <SiteHeader locale={locale} />
      <SignUpView params={params} />
    </div>
  );
}
