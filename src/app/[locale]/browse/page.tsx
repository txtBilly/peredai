import dynamic from 'next/dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import { redirectIfBanned } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Same ssr:false pattern as /list: this page's content depends on a
// client-only first fetch (search/filters against Supabase, plus the
// current user's favourites), so it's loaded with no server render at all
// to rule out hydration mismatches on the loading state.
const BrowseView = dynamic(() => import('./BrowseView'), {
  ssr: false,
  loading: () => (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ten2ten-logo.svg?v=5" alt="Ten2Ten" className="mb-3 h-6 w-auto" />
      <p className="text-sm text-muted">Loading…</p>
    </main>
  ),
});

// Neo-Classified Browse renders its own light top bar, so no shared dark header.
export default async function BrowsePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  await redirectIfBanned(locale);

  // A renter with an open conversation can't browse new places until they close
  // it. Browse stays reachable (nav isn't disabled), but it shows a message and
  // a link back to the chat instead of listings. Listers are unaffected.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let seekerChatId: string | null = null;
  if (user) {
    const { data } = await supabase
      .from('chats')
      .select('id')
      .eq('seeker_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    seekerChatId = data?.id ?? null;
  }

  if (seekerChatId) {
    const b = getDictionary(locale).browse;
    const [beforeLink, afterLink] = b.lockedBody.split('{link}');
    // Break the title after the first comma so "so just…" starts a new line.
    const commaIdx = b.lockedTitle.indexOf(', ');
    const titleNode =
      commaIdx >= 0 ? (
        <>
          {b.lockedTitle.slice(0, commaIdx + 1)}
          <br />
          {b.lockedTitle.slice(commaIdx + 2)}
        </>
      ) : (
        b.lockedTitle
      );
    return (
      <div className="neo-page">
        <SiteHeader locale={locale} />
        <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-start px-5 pt-[24vh]">
          <h1 className="mb-8 w-full max-w-[36rem] font-display text-[1.8rem] font-bold leading-tight text-ink">
            {titleNode}
          </h1>
          <p className="w-full max-w-[36rem] text-justify text-[1.26rem] leading-relaxed text-muted [hyphens:auto]">
            {beforeLink}
            <Link
              href={`/${locale}/chats/${seekerChatId}`}
              className="font-medium text-cobalt underline decoration-cobalt/40 underline-offset-2 hover:decoration-cobalt"
            >
              {b.lockedLink}
            </Link>
            {afterLink}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="neo-page">
      <SiteHeader locale={locale} />
      <BrowseView locale={locale} />
    </div>
  );
}
