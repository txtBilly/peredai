import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import { createClient } from '@/lib/supabase/server';

// Same ssr:false pattern as the rest of Session 3: this page's content is a
// client-only fetch of the current lister's own listings, so it's loaded
// with no server render to rule out hydration mismatches on the loading
// state.
const MyListingsView = dynamic(() => import('./MyListingsView'), {
  ssr: false,
  loading: () => (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 text-center">
      <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
      <p className="text-sm text-muted">Loading…</p>
    </main>
  ),
});

export default async function MyListingsPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  // Opening My Listings clears the "listing activity" red dot. Runs before the
  // header renders so the badge is already gone here. Owner-scoped by RLS.
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('listings')
        .update({ lister_unseen: false })
        .eq('lister_id', user.id)
        .eq('lister_unseen', true);
    }
  } catch {
    // A failed clear just means the dot lingers — non-fatal.
  }

  return (
    <>
      <SiteHeader locale={locale} />
      <MyListingsView locale={locale} />
    </>
  );
}
