import { NextRequest, NextResponse } from 'next/server';
import { getPayment } from '@/lib/yookassa';
import { grantPurchaseCredits } from '@/lib/credits';

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
      // credit_ledger.stripe_payment_intent is the unique idempotency key; we
      // reuse it to store the YooKassa payment id, so a duplicate notification
      // hits the constraint instead of double-crediting.
      await grantPurchaseCredits({ seekerId, stripePaymentIntent: payment.id });
    }
  } catch (e) {
    console.error('[yookassa] failed to process notification', e);
    // 500 so YooKassa retries the notification.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
