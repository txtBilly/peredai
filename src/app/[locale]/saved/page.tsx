import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import { redirectIfBanned } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Client-only (favourites + listings fetch), same ssr:false pattern as Browse.
const SavedView = dynamic(() => import('./SavedView'), {
  ssr: false,
  loading: () => (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/peredai-logo.svg?v=1" alt="Ten2Ten" className="mb-3 h-6 w-auto" />
      <p className="text-sm text-muted">Loading…</p>
    </main>
  ),
});

export default async function SavedPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  await redirectIfBanned(locale);

  // Opening the Saved page clears the "reopened" red dot. Runs before the header
  // renders, so the badge is already gone on this page. Owner-scoped by RLS.
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('favourites')
        .update({ freed_unseen: false })
        .eq('seeker_id', user.id)
        .eq('freed_unseen', true);
    }
  } catch {
    // A failed clear just means the dot lingers — non-fatal.
  }

  return (
    <div className="neo-page">
      <SiteHeader locale={locale} />
      <SavedView locale={locale} />
    </div>
  );
}
