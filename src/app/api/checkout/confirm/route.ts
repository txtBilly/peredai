import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { grantPurchaseCredits } from '@/lib/credits';

// Mock-only: simulates a completed SBP payment from the mock QR page. Grants the
// contact-credit bundle, then returns the seeker to the listing so they can
// Connect. In real mode this endpoint is inert — credits are granted by the
// YooKassa webhook on payment.succeeded, never by a client POST.
function paymentsAreMock(): boolean {
  return (
    process.env.PAYMENTS_PROVIDER === 'mock' ||
    !process.env.YOOKASSA_SHOP_ID ||
    process.env.YOOKASSA_SHOP_ID === 'test-shop-id'
  );
}

export async function POST(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const form = await req.formData().catch(() => null);
  const rawLocale = form?.get('locale');
  const locale: 'ru' | 'en' = rawLocale === 'en' ? 'en' : 'ru';
  const listingIdRaw = form?.get('listing_id');
  const listingId =
    typeof listingIdRaw === 'string' && listingIdRaw ? listingIdRaw : null;

  if (!user) return NextResponse.redirect(`${appUrl}/${locale}/login`, 303);

  // Hard stop: never grant credits from a client POST in production.
  if (!paymentsAreMock()) {
    return NextResponse.json({ error: 'not_mock' }, { status: 403 });
  }

  try {
    await grantPurchaseCredits({
      seekerId: user.id,
      stripePaymentIntent: `mocksbp_${user.id}_${Date.now()}`,
    });
  } catch (e) {
    console.error('[checkout/confirm] mock grant failed', e);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }

  const returnUrl = listingId
    ? `${appUrl}/${locale}/browse/${listingId}?purchase=success`
    : `${appUrl}/${locale}/account?purchase=success`;
  return NextResponse.redirect(returnUrl, 303);
}
