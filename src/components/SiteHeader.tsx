import Link from 'next/link';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

// Shared top navigation. Kept out of the root layout so auth-only screens
// (signin/signup/verify) stay chromeless; rendered explicitly on the pages
// that want it (Browse, My listings). Surfaces the Browse entry point so a
// seeker always has a way back to listings.
export default async function SiteHeader({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const otherLocale = locale === 'en' ? 'es' : 'en';

  // Red-dot badge: does the signed-in seeker have a saved listing that just
  // reopened and hasn't been seen yet? Cheap head-count against the partial
  // index; silent for signed-out visitors.
  let savedHasUnseen = false;
  let listHasUnseen = false;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [{ count: savedCount }, { count: listCount }] = await Promise.all([
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
      ]);
      savedHasUnseen = (savedCount ?? 0) > 0;
      listHasUnseen = (listCount ?? 0) > 0;
    }
  } catch {
    // Never let a badge lookup break the header.
  }

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-black/[0.06] px-5 py-4">
      <Link href={`/${locale}/browse`} aria-label={dict.brand.name} className="inline-flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ten2ten-logo.svg?v=3" alt={dict.brand.name} className="h-7 w-auto" />
      </Link>
      <nav className="flex items-center gap-5 text-sm text-muted">
        <Link href={`/${locale}/browse`} className="hover:text-ink">
          {dict.nav.browse}
        </Link>
        <Link href={`/${locale}/saved`} className="relative hover:text-ink">
          {dict.nav.saved}
          {savedHasUnseen && (
            <span
              aria-label="Saved listing available"
              className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
            />
          )}
        </Link>
        <Link href={`/${locale}/welcome`} className="hover:text-ink">
          {dict.nav.howItWorks}
        </Link>
        <Link href={`/${locale}/list`} className="relative hover:text-ink">
          {dict.nav.list}
          {listHasUnseen && (
            <span
              aria-label="Listing activity"
              className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
            />
          )}
        </Link>
        <Link href={`/${locale}/account`} className="hover:text-ink">
          {dict.nav.account}
        </Link>
        <Link
          href={`/${otherLocale}`}
          className="rounded-full border border-black/15 px-3 py-1 uppercase hover:border-black/40"
        >
          {otherLocale}
        </Link>
      </nav>
    </header>
  );
}
