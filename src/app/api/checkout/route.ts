import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createContactPayment } from '@/lib/yookassa';

// Mock payments (preview/dev): no real processor is configured, so the purchase
// completes instantly and tokens are granted here (there's no webhook). Active
// when PAYMENTS_PROVIDER=mock, or when YooKassa credentials are absent/placeholder.
function paymentsAreMock(): boolean {
  return (
    process.env.PAYMENTS_PROVIDER === 'mock' ||
    !process.env.YOOKASSA_SHOP_ID ||
    process.env.YOOKASSA_SHOP_ID === 'test-shop-id'
  );
}

// Creates a YooKassa payment for the contact-credit bundle and redirects the
// seeker to its hosted confirmation page. Submit as a plain form POST:
//   <form action="/api/checkout" method="POST">
//     <input type="hidden" name="locale" value="ru" />
//     <input type="hidden" name="listing_id" value="…" />
//     <button>Купить 3 кредита</button>
//   </form>
// Credits are granted by the YooKassa webhook on payment.succeeded — never here.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: 'no_email' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const requestedLocale = form?.get('locale');
  const listingIdRaw = form?.get('listing_id');
  const listingId = typeof listingIdRaw === 'string' && listingIdRaw ? listingIdRaw : null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('preferred_locale')
    .eq('id', user.id)
    .maybeSingle();

  const locale: 'ru' | 'en' =
    requestedLocale === 'en' || requestedLocale === 'ru'
      ? requestedLocale
      : profile?.preferred_locale === 'en'
        ? 'en'
        : 'ru';

  // Base URL comes from the incoming request so redirects always target the
  // host the user is actually on (ten2ten.ru, 10210.ru, or localhost). Do NOT
  // use NEXT_PUBLIC_APP_URL here — it's inlined at build time and was sending
  // live users to http://localhost:3000.
  const appUrl = req.nextUrl.origin;

  // A lister can't connect to their own listing — refuse before any charge.
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

  // After paying, YooKassa sends the seeker to return_url. Point them back at the
  // listing they came from (so they can Connect once credits land), else account.
  const returnUrl = listingId
    ? `${appUrl}/${locale}/browse/${listingId}?purchase=success`
    : `${appUrl}/${locale}/account?purchase=success`;

  // Preview/dev: no real processor. Instead of granting silently, send the
  // seeker to the mock SBP-QR page; credits are granted only when they confirm
  // there (POST /api/checkout/confirm), mirroring the real flow where credits
  // land after payment — never on the click.
  if (paymentsAreMock()) {
    const payUrl = listingId
      ? `${appUrl}/${locale}/pay?listing_id=${encodeURIComponent(listingId)}`
      : `${appUrl}/${locale}/pay`;
    return NextResponse.redirect(payUrl, 303);
  }

  try {
    const { confirmationUrl } = await createContactPayment({
      seekerId: user.id,
      email: user.email,
      returnUrl,
    });
    return NextResponse.redirect(confirmationUrl, 303);
  } catch (e) {
    console.error('[checkout] failed to create YooKassa payment', e);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }
}
