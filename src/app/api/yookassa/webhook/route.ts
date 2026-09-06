import { NextRequest, NextResponse } from 'next/server';
import { getPayment } from '@/lib/yookassa';
import { grantPurchaseCredits, CREDITS_PER_PURCHASE } from '@/lib/credits';
import { recordRedemption } from '@/lib/coupons';

// YooKassa payment notifications. Unlike Stripe, these are not signed, so we
// never trust the posted body: we take only the payment id from it and re-fetch
// the payment from the YooKassa API to confirm its real status before granting
// anything. (Best practice per YooKassa docs; also restrict by source IP at the
// edge/proxy in production.)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let event: { event?: string; object?: { id?: string } };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const paymentId = event?.object?.id;
  if (!paymentId) {
    return NextResponse.json({ error: 'no_payment_id' }, { status: 400 });
  }

  // Only act on succeeded payments; ignore pending/canceled/waiting notifications.
  if (event.event && event.event !== 'payment.succeeded') {
    return NextResponse.json({ received: true });
  }

  try {
    const payment = await getPayment(paymentId);
    if (payment.status !== 'succeeded' || !payment.paid) {
      // Not actually paid — acknowledge without granting.
      return NextResponse.json({ received: true });
    }

    const seekerId = payment.metadata?.seeker_id;
    const kind = payment.metadata?.kind;
    if (kind === 'contact_bundle' && seekerId) {
      // Token count comes from the payment metadata (base + any coupon bonus),
      // falling back to the default bundle for older payments.
      const credits = Number(payment.metadata?.credits) || CREDITS_PER_PURCHASE;
      const couponId = payment.metadata?.coupon_id;
      const couponCode = payment.metadata?.coupon_code;
      const discountRub = Number(payment.metadata?.discount_rub) || 0;

      // Record the coupon redemption first — the unique (coupon,user) constraint
      // makes retries idempotent. Do this before granting so a coupon can't be
      // over-redeemed across duplicate notifications.
      if (couponId) {
        await recordRedemption({
          couponId,
          userId: seekerId,
          amountDiscounted: discountRub,
          creditsGranted: credits,
          paymentRef: payment.id,
        });
      }
      // credit_ledger.stripe_payment_intent is the unique idempotency key; we
      // reuse it to store the YooKassa payment id, so a duplicate notification
      // hits the constraint instead of double-crediting.
      await grantPurchaseCredits({
        seekerId,
        stripePaymentIntent: payment.id,
        amount: credits,
        note: couponCode ? `Purchase (coupon ${couponCode}): ${credits} tokens` : undefined,
      });
    }
  } catch (e) {
    console.error('[yookassa] failed to process notification', e);
    // 500 so YooKassa retries the notification.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
