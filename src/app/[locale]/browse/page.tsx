import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import { redirectIfBanned } from '@/lib/auth';

// Same ssr:false pattern as /list: this page's content depends on a
// client-only first fetch (search/filters against Supabase, plus the
// current user's favourites), so it's loaded with no server render at all
// to rule out hydration mismatches on the loading state.
const BrowseView = dynamic(() => import('./BrowseView'), {
  ssr: false,
  loading: () => (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ten2ten-logo.svg?v=3" alt="Ten2Ten" className="mb-3 h-6 w-auto" />
      <p className="text-sm text-muted">Loading…</p>
    </main>
  ),
});

// Neo-Classified Browse renders its own light top bar, so no shared dark header.
export default async function BrowsePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  await redirectIfBanned(locale);
  return (
    <div className="neo-page">
      <SiteHeader locale={locale} />
      <BrowseView locale={locale} />
    </div>
  );
}
