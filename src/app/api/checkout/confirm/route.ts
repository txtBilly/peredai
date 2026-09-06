import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { grantPurchaseCredits, CREDITS_PER_PURCHASE } from '@/lib/credits';
import { CONTACT_BUNDLE_PRICE_RUB, createContactPayment } from '@/lib/yookassa';
import { paymentsAreMock } from '@/lib/payments';
import { validateCoupon, priceForCoupon, recordRedemption, normalizeCouponCode } from '@/lib/coupons';

// Commit the purchase from the /pay review screen (both modes):
//   - mock:      grant tokens immediately (no processor), record any coupon.
//   - free coupon (any mode): grant directly, no payment.
//   - real:      create a YooKassa payment for the discounted amount and redirect
//                to its QR; tokens + coupon redemption land in the webhook.
// The price and token count are recomputed here server-side — the client's
// preview is never trusted.
export async function POST(req: NextRequest) {
  const appUrl = req.nextUrl.origin;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const form = await req.formData().catch(() => null);
  const rawLocale = form?.get('locale');
  const locale: 'ru' | 'en' = rawLocale === 'en' ? 'en' : 'ru';
  const listingIdRaw = form?.get('listing_id');
  const listingId = typeof listingIdRaw === 'string' && listingIdRaw ? listingIdRaw : null;
  const couponCode = normalizeCouponCode(
    typeof form?.get('coupon') === 'string' ? (form?.get('coupon') as string) : ''
  );

  if (!user) return NextResponse.redirect(`${appUrl}/${locale}/signin`, 303);

  const payUrl = listingId
    ? `${appUrl}/${locale}/pay?listing_id=${encodeURIComponent(listingId)}`
    : `${appUrl}/${locale}/pay`;
  const successUrl = listingId
    ? `${appUrl}/${locale}/browse/${listingId}?purchase=success`
    : `${appUrl}/${locale}/account?purchase=success`;

  // Resolve price + tokens, applying a coupon if one was entered. A coupon that
  // fails validation at commit sends the user back to the pay screen with an error.
  let priceRub = CONTACT_BUNDLE_PRICE_RUB;
  let credits = CREDITS_PER_PURCHASE;
  let discountRub = 0;
  let couponId: string | null = null;
  let resolvedCode: string | null = null;
  if (couponCode) {
    const v = await validateCoupon(couponCode, user.id);
    if (!v.ok) {
      return NextResponse.redirect(`${payUrl}${payUrl.includes('?') ? '&' : '?'}coupon_error=${v.reason}`, 303);
    }
    const pricing = priceForCoupon(v.coupon);
    priceRub = pricing.finalPriceRub;
    credits = pricing.totalCredits;
    discountRub = pricing.discountRub;
    couponId = v.coupon.id;
    resolvedCode = v.coupon.code;
  }

  const mock = paymentsAreMock();
  const isFree = priceRub <= 0;

  // Direct-grant path: mock mode, or a free (100%-off) coupon in any mode.
  if (mock || isFree) {
    const ref = `${mock ? 'mocksbp' : 'freecoupon'}_${user.id}_${Date.now()}`;
    // For a coupon, record the redemption FIRST — the unique (coupon,user)
    // constraint is the atomic guard against a double redemption; only grant if
    // it took.
    if (couponId) {
      const ok = await recordRedemption({
        couponId,
        userId: user.id,
        amountDiscounted: discountRub,
        creditsGranted: credits,
        paymentRef: ref,
      });
      if (!ok) {
        return NextResponse.redirect(`${payUrl}${payUrl.includes('?') ? '&' : '?'}coupon_error=already_used`, 303);
      }
    }
    try {
      await grantPurchaseCredits({
        seekerId: user.id,
        stripePaymentIntent: ref,
        amount: credits,
        note: resolvedCode ? `Purchase (coupon ${resolvedCode}): ${credits} tokens` : undefined,
      });
    } catch (e) {
      console.error('[checkout/confirm] grant failed', e);
      return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
    }
    return NextResponse.redirect(successUrl, 303);
  }

  // Real, non-free: create a YooKassa payment for the discounted amount. Tokens
  // and the coupon redemption are applied by the webhook on payment.succeeded.
  if (!user.email) return NextResponse.json({ error: 'no_email' }, { status: 400 });
  try {
    const { confirmationUrl } = await createContactPayment({
      seekerId: user.id,
      email: user.email,
      returnUrl: successUrl,
      priceRub,
      credits,
      ...(couponId ? { couponId } : {}),
      ...(resolvedCode ? { couponCode: resolvedCode } : {}),
      ...(discountRub ? { discountRub } : {}),
    });
    return NextResponse.redirect(confirmationUrl, 303);
  } catch (e) {
    console.error('[checkout/confirm] YooKassa create failed', e);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }
}
