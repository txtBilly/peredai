import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Entry point for "buy tokens" / Connect-without-credits. Sends the seeker to the
// /pay review screen, where they see the price, can apply a coupon, and then
// commit. The actual charge/grant happens at /api/checkout/confirm — for both
// mock and real (YooKassa) modes — so a coupon is always applied before any
// payment is created. Submit as a plain form POST:
//   <form action="/api/checkout" method="POST">
//     <input type="hidden" name="locale" value="ru" />
//     <input type="hidden" name="listing_id" value="…" />
//     <button>Купить токены</button>
//   </form>
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const form = await req.formData().catch(() => null);
  const requestedLocale = form?.get('locale');
  const listingIdRaw = form?.get('listing_id');
  const listingId = typeof listingIdRaw === 'string' && listingIdRaw ? listingIdRaw : null;

  const appUrl = req.nextUrl.origin;
  const admin = createAdminClient();

  // Model A: anonymous seekers can start the funnel — the /pay screen collects
  // email + consent and creates the account at payment. Only look up a profile /
  // guard own-listing when we actually have a signed-in user.
  let locale: 'ru' | 'en' =
    requestedLocale === 'en' || requestedLocale === 'ru' ? requestedLocale : 'ru';

  if (user) {
    const { data: profile } = await admin
      .from('profiles')
      .select('preferred_locale')
      .eq('id', user.id)
      .maybeSingle();
    if (requestedLocale !== 'en' && requestedLocale !== 'ru' && profile?.preferred_locale === 'en') {
      locale = 'en';
    }
    // A lister can't connect to their own listing — refuse before the pay screen.
    if (listingId) {
      const { data: listingRow } = await admin
        .from('listings')
        .select('lister_id')
        .eq('id', listingId)
        .maybeSingle();
      if (listingRow && listingRow.lister_id === user.id) {
        return NextResponse.redirect(`${appUrl}/${locale}/browse/${listingId}?blocked=own_listing`, 303);
      }
    }
  }

  const payUrl = listingId
    ? `${appUrl}/${locale}/pay?listing_id=${encodeURIComponent(listingId)}`
    : `${appUrl}/${locale}/pay`;
  return NextResponse.redirect(payUrl, 303);
}
