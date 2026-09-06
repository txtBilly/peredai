import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { mintSessionForEmail } from '@/lib/auth-session';
import { CURRENT_CONSENT_VERSION } from '@/lib/consent';
import { grantPurchaseCredits, CREDITS_PER_PURCHASE } from '@/lib/credits';
import { CONTACT_BUNDLE_PRICE_RUB, createContactPayment } from '@/lib/yookassa';
import { paymentsAreMock } from '@/lib/payments';
import { validateCoupon, priceForCoupon, recordRedemption, normalizeCouponCode } from '@/lib/coupons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Commit the purchase from the /pay review screen.
//
// Model A: a seeker can arrive ANONYMOUS. In that case the pay screen also
// collects email + consent; here we create the account from that email (a
// brand-new email → create + sign in, same trust model as signup), grant tokens,
// and open the funnel. An email that ALREADY has an account is sent to sign-in
// rather than silently logged in (that would be account takeover).
//
// Price/tokens are always recomputed server-side; the client preview is never trusted.
export async function POST(req: NextRequest) {
  const appUrl = req.nextUrl.origin;
  const supabase = createClient();
  let {
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
  const emailInput = (typeof form?.get('email') === 'string' ? (form?.get('email') as string) : '')
    .trim()
    .toLowerCase();
  const consent = form?.get('consent') === 'on' || form?.get('consent') === 'true';

  const payUrl = listingId
    ? `${appUrl}/${locale}/pay?listing_id=${encodeURIComponent(listingId)}`
    : `${appUrl}/${locale}/pay`;
  const successUrl = listingId
    ? `${appUrl}/${locale}/browse/${listingId}?purchase=success`
    : `${appUrl}/${locale}/account?purchase=success`;
  const backWith = (param: string) =>
    NextResponse.redirect(`${payUrl}${payUrl.includes('?') ? '&' : '?'}${param}`, 303);

  // --- Anonymous seeker: create the account from email + consent ---
  if (!user) {
    if (!EMAIL_RE.test(emailInput)) return backWith('form_error=invalid_email');
    if (!consent) return backWith('form_error=consent_required');

    const admin = createAdminClient();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: emailInput,
      email_confirm: true, // passwordless; receipt + magic-link sign-in prove ownership
      user_metadata: {
        preferred_locale: locale,
        consent_version: CURRENT_CONSENT_VERSION,
        consented_at: new Date().toISOString(),
      },
    });
    if (createErr || !created?.user) {
      const m = (createErr?.message ?? '').toLowerCase();
      // Existing email → do NOT mint a session (that would be takeover). Send them
      // to sign in first.
      if (m.includes('already') || m.includes('registered') || m.includes('exist')) {
        return NextResponse.redirect(`${appUrl}/${locale}/signin?email_exists=1`, 303);
      }
      console.error('[checkout/confirm] createUser failed', createErr);
      return backWith('form_error=signup_failed');
    }
    const minted = await mintSessionForEmail(emailInput);
    if (!minted.ok) {
      console.error('[checkout/confirm] session mint failed', minted.error);
      return backWith('form_error=signup_failed');
    }
    user = created.user;
  }

  const seekerId = user.id;
  const seekerEmail = user.email ?? emailInput;

  // Resolve price + tokens, applying a coupon if one was entered.
  let priceRub = CONTACT_BUNDLE_PRICE_RUB;
  let credits = CREDITS_PER_PURCHASE;
  let discountRub = 0;
  let couponId: string | null = null;
  let resolvedCode: string | null = null;
  if (couponCode) {
    const v = await validateCoupon(couponCode, seekerId);
    if (!v.ok) return backWith(`coupon_error=${v.reason}`);
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
    const ref = `${mock ? 'mocksbp' : 'freecoupon'}_${seekerId}_${Date.now()}`;
    if (couponId) {
      const ok = await recordRedemption({
        couponId,
        userId: seekerId,
        amountDiscounted: discountRub,
        creditsGranted: credits,
        paymentRef: ref,
      });
      if (!ok) return backWith('coupon_error=already_used');
    }
    try {
      await grantPurchaseCredits({
        seekerId,
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
  if (!seekerEmail) return NextResponse.json({ error: 'no_email' }, { status: 400 });
  try {
    const { confirmationUrl } = await createContactPayment({
      seekerId,
      email: seekerEmail,
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
