import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAcquiringOperation } from '@/lib/tochka';
import { grantPurchaseCredits } from '@/lib/credits';
import { recordRedemption } from '@/lib/coupons';

export const runtime = 'nodejs';

// Poll an acquiring payment's status by our intent ref (qrc_id) and grant tokens
// once Tochka reports the operation APPROVED. Called by /pay/return while the
// buyer is back from Tochka's payment page. Authoritative + idempotent
// (credit_ledger key = tochka_<operationId>); the webhook is the backstop.
type IntentRow = {
  trx_id: string | null;
  seeker_id: string;
  credits: number;
  discount_rub: number | null;
  coupon_id: string | null;
  coupon_code: string | null;
  status: string;
};

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref');
  if (!ref) return NextResponse.json({ error: 'no_ref' }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('sbp_intents')
    .select('trx_id, seeker_id, credits, discount_rub, coupon_id, coupon_code, status')
    .eq('qrc_id', ref)
    .maybeSingle();
  const intent = data as IntentRow | null;
  if (!intent || intent.seeker_id !== user.id) return NextResponse.json({ status: 'not_found' }, { status: 404 });
  if (intent.status === 'granted') return NextResponse.json({ status: 'granted' });
  if (!intent.trx_id) return NextResponse.json({ status: 'pending' });

  const { status } = await getAcquiringOperation(intent.trx_id);

  if (status === 'APPROVED') {
    const grantRef = `tochka_${intent.trx_id}`;
    if (intent.coupon_id) {
      await recordRedemption({
        couponId: intent.coupon_id,
        userId: intent.seeker_id,
        amountDiscounted: intent.discount_rub ?? 0,
        creditsGranted: intent.credits,
        paymentRef: grantRef,
      });
    }
    try {
      await grantPurchaseCredits({
        seekerId: intent.seeker_id,
        stripePaymentIntent: grantRef,
        amount: intent.credits,
        note: intent.coupon_code
          ? `Purchase (coupon ${intent.coupon_code}): ${intent.credits} tokens`
          : undefined,
      });
    } catch (e) {
      console.error('[acquiring-status] grant failed', e);
      return NextResponse.json({ status: 'processing' });
    }
    await admin
      .from('sbp_intents')
      .update({ status: 'granted', updated_at: new Date().toISOString() })
      .eq('qrc_id', ref);
    return NextResponse.json({ status: 'granted' });
  }

  if (status === 'EXPIRED' || status === 'REFUNDED') {
    await admin
      .from('sbp_intents')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('qrc_id', ref);
    return NextResponse.json({ status: 'rejected' });
  }

  return NextResponse.json({ status: 'pending' });
}
