import Link from 'next/link';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import AutoHideHeader from '@/components/AutoHideHeader';

// Shared top navigation. Kept out of the root layout so auth-only screens
// (signin/signup/verify) stay chromeless; rendered explicitly on the pages
// that want it (Browse, My listings). Surfaces the Browse entry point so a
// seeker always has a way back to listings.
export default async function SiteHeader({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const otherLocale = locale === 'en' ? 'ru' : 'en';
  // Show the Russian option in Cyrillic (РУ), English as EN.
  const otherLocaleLabel = otherLocale === 'ru' ? 'РУС' : 'EN';

  // Red-dot badge: does the signed-in seeker have a saved listing that just
  // reopened and hasn't been seen yet? Cheap head-count against the partial
  // index; silent for signed-out visitors.
  let savedHasUnseen = false;
  let listHasUnseen = false;
  // Open-conversation rules: a seeker with a live chat can't browse (Browse is
  // disabled and routes back to the chat); a lister with a live chat keeps a
  // persistent red dot on List. Both get a Chat shortcut.
  let seekerChatId: string | null = null;
  let listerChatId: string | null = null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [{ count: savedCount }, { count: listCount }, { data: sChat }, { data: lChat }] = await Promise.all([
        supabase
          .from('favourites')
          .select('seeker_id', { count: 'exact', head: true })
          .eq('seeker_id', user.id)
          .eq('freed_unseen', true),
        supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('lister_id', user.id)
          .eq('lister_unseen', true),
        supabase
          .from('chats')
          .select('id')
          .eq('seeker_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('chats')
          .select('id')
          .eq('lister_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle(),
      ]);
      savedHasUnseen = (savedCount ?? 0) > 0;
      listHasUnseen = (listCount ?? 0) > 0;
      seekerChatId = sChat?.id ?? null;
      listerChatId = lChat?.id ?? null;
    }
  } catch {
    // Never let a badge lookup break the header.
  }

  // A user can hold one chat as a renter and one as a lister at the same time;
  // both appear under the Chat menu.
  const chatLinks: { id: string; label: string }[] = [];
  if (seekerChatId) chatLinks.push({ id: seekerChatId, label: dict.nav.chatAsRenter });
  if (listerChatId) chatLinks.push({ id: listerChatId, label: dict.nav.chatAsLister });
  // The Chat nav now signals open conversations, so the List dot only reflects
  // an unseen listing status change (not the open chat itself).
  const listShowsDot = listHasUnseen;

  // Single source of truth for the nav entries, rendered both in the desktop
  // inline bar and the mobile dropdown so the two never drift apart.
  const navLinks: { href: string; label: string; dot?: boolean; cobalt?: boolean }[] = [];
  if (chatLinks.length > 0) {
    navLinks.push({
      href: chatLinks.length === 1 ? `/${locale}/chats/${chatLinks[0].id}` : `/${locale}/chats`,
      label: dict.nav.chat,
      cobalt: true,
    });
  }
  navLinks.push({ href: `/${locale}/browse`, label: dict.nav.browse });
  navLinks.push({ href: `/${locale}/saved`, label: dict.nav.saved, dot: savedHasUnseen });
  navLinks.push({ href: `/${locale}/welcome`, label: dict.nav.howItWorks });
  navLinks.push({ href: `/${locale}/list`, label: dict.nav.list, dot: listShowsDot });
  navLinks.push({ href: `/${locale}/account`, label: dict.nav.account });

  return (
    <AutoHideHeader>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
      <Link href={`/${locale}/browse`} aria-label={dict.brand.name} className="inline-flex shrink-0 items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ten2ten-logo.svg?v=1" alt={dict.brand.name} className="h-[22px] w-auto" />
        <span aria-hidden="true" className="h-7 w-px bg-black/15" />
        <span className="max-w-[6.5rem] text-[11.5px] font-medium lowercase leading-[1.15] tracking-[0.02em] text-muted">
          {dict.brand.slogan}
        </span>
      </Link>

      {/* Desktop: inline nav. Hidden below sm where it would wrap into a mess. */}
      <nav className="hidden items-center gap-5 text-sm text-muted sm:flex">
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={
              l.cobalt
                ? 'font-medium text-cobalt hover:text-cobalt2'
                : 'relative hover:text-ink'
            }
          >
            {l.label}
            {l.dot && (
              <span
                aria-hidden
                className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
              />
            )}
          </Link>
        ))}
        <Link
          href={`/${otherLocale}`}
          className="rounded-full border border-black/15 px-3 py-1 uppercase hover:border-black/40"
        >
          {otherLocaleLabel}
        </Link>
      </nav>

      {/* Mobile: CSS-only hamburger dropdown (keeps this a server component). */}
      <details className="group relative sm:hidden">
        <summary
          className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-black/10 text-ink [&::-webkit-details-marker]:hidden"
          aria-label="Menu"
        >
          <svg className="h-5 w-5 group-open:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg className="hidden h-5 w-5 group-open:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </summary>
        <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center justify-between px-4 py-3 text-base ${
                l.cobalt ? 'font-medium text-cobalt' : 'text-ink'
              } hover:bg-black/[0.04]`}
            >
              {l.label}
              {l.dot && <span className="h-2 w-2 rounded-full bg-red-500" />}
            </Link>
          ))}
          <Link
            href={`/${otherLocale}`}
            className="flex items-center px-4 py-3 text-base uppercase text-muted hover:bg-black/[0.04]"
          >
            {otherLocaleLabel}
          </Link>
        </div>
      </details>
      </div>
    </AutoHideHeader>
  );
}
