import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getQrPaymentStatus } from '@/lib/tochka';
import { grantPurchaseCredits } from '@/lib/credits';
import { recordRedemption } from '@/lib/coupons';

export const runtime = 'nodejs';

// Poll the payment status of an SBP QR and grant tokens once Tochka reports the
// payment as "Accepted". Called by the /pay/qr page while the seeker has it open.
// The grant is the authoritative confirmation (re-checked against Tochka's API,
// never trusting a client) and is idempotent: credit_ledger.stripe_payment_intent
// = `tochka_<qrcId>` is unique, so repeated polls / the webhook can't double-credit.
type IntentRow = {
  qrc_id: string;
  seeker_id: string;
  credits: number;
  discount_rub: number | null;
  coupon_id: string | null;
  coupon_code: string | null;
  status: string;
};

export async function GET(req: NextRequest) {
  const qrc = req.nextUrl.searchParams.get('qrc');
  if (!qrc) return NextResponse.json({ error: 'no_qrc' }, { status: 400 });

  // Must be the signed-in owner of this intent.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data: intentData } = await admin
    .from('sbp_intents')
    .select('qrc_id, seeker_id, credits, discount_rub, coupon_id, coupon_code, status')
    .eq('qrc_id', qrc)
    .maybeSingle();
  const intent = intentData as IntentRow | null;
  if (!intent || intent.seeker_id !== user.id) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }
  if (intent.status === 'granted') return NextResponse.json({ status: 'granted' });

  const { status, trxId } = await getQrPaymentStatus(qrc);

  if (status === 'Accepted') {
    const ref = `tochka_${qrc}`;
    if (intent.coupon_id) {
      await recordRedemption({
        couponId: intent.coupon_id,
        userId: intent.seeker_id,
        amountDiscounted: intent.discount_rub ?? 0,
        creditsGranted: intent.credits,
        paymentRef: ref,
      });
    }
    try {
      await grantPurchaseCredits({
        seekerId: intent.seeker_id,
        stripePaymentIntent: ref,
        amount: intent.credits,
        note: intent.coupon_code
          ? `Purchase (coupon ${intent.coupon_code}): ${intent.credits} tokens`
          : undefined,
      });
    } catch (e) {
      console.error('[sbp-status] grant failed', e);
      return NextResponse.json({ status: 'processing' });
    }
    await admin
      .from('sbp_intents')
      .update({ status: 'granted', trx_id: trxId ?? null, updated_at: new Date().toISOString() })
      .eq('qrc_id', qrc);
    return NextResponse.json({ status: 'granted' });
  }

  if (status === 'Rejected') {
    await admin
      .from('sbp_intents')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('qrc_id', qrc);
    return NextResponse.json({ status: 'rejected' });
  }

  // NotStarted / Received / InProgress / Unknown → keep waiting.
  return NextResponse.json({ status });
}
