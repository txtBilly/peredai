import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import SignInView from './SignInView';

// Server wrapper so the sign-in screen carries the regular top header (logo +
// nav). The form itself lives in SignInView (client).
export default function SignInPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  return (
    <div className="neo-page">
      <SiteHeader locale={locale} />
      <SignInView params={params} />
    </div>
  );
}
