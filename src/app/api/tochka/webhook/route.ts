import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getQrPaymentStatus } from '@/lib/tochka';
import { grantPurchaseCredits } from '@/lib/credits';
import { recordRedemption } from '@/lib/coupons';

export const runtime = 'nodejs';

// Inbound Tochka webhook (incomingSbpPayment). We do NOT trust the posted body:
// we extract a qrcId, then re-confirm the payment against Tochka's payment-status
// API before granting anything — so a forged POST can't grant tokens. The grant
// is idempotent (credit_ledger key = tochka_<qrcId>), so it's safe alongside the
// /pay/qr poller. Every delivery is logged to tochka_webhook_log for inspection
// (the payload shape / signature aren't documented, so we capture the real one).

// Best-effort qrcId extraction: works whether the body is a JSON object or a
// signed JWT (header.payload.signature) whose payload segment is base64url JSON.
function extractQrcId(body: string): string | undefined {
  const scan = (obj: unknown): string | undefined => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === 'qrcId' && typeof v === 'string') return v;
      if (v && typeof v === 'object') {
        const r = scan(v);
        if (r) return r;
      }
    }
    return undefined;
  };
  try {
    const r = scan(JSON.parse(body));
    if (r) return r;
  } catch {
    /* not JSON — try JWT below */
  }
  const parts = body.trim().split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(
        parts[1].replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf8');
      const r = scan(JSON.parse(payloadJson));
      if (r) return r;
    } catch {
      /* not a decodable JWT */
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const body = await req.text().catch(() => '');
  const admin = createAdminClient();

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });

  const qrcId = extractQrcId(body);
  let action = qrcId ? 'captured' : 'captured_no_qrc';

  if (qrcId) {
    try {
      const { data } = await admin
        .from('sbp_intents')
        .select('seeker_id, credits, discount_rub, coupon_id, coupon_code, status')
        .eq('qrc_id', qrcId)
        .maybeSingle();
      if (!data) {
        action = 'no_intent';
      } else if (data.status === 'granted') {
        action = 'already_granted';
      } else {
        const { status, trxId } = await getQrPaymentStatus(qrcId);
        if (status === 'Accepted') {
          const ref = `tochka_${qrcId}`;
          if (data.coupon_id) {
            await recordRedemption({
              couponId: data.coupon_id,
              userId: data.seeker_id,
              amountDiscounted: data.discount_rub ?? 0,
              creditsGranted: data.credits,
              paymentRef: ref,
            });
          }
          await grantPurchaseCredits({
            seekerId: data.seeker_id,
            stripePaymentIntent: ref,
            amount: data.credits,
            note: data.coupon_code
              ? `Purchase (coupon ${data.coupon_code}): ${data.credits} tokens`
              : undefined,
          });
          await admin
            .from('sbp_intents')
            .update({ status: 'granted', trx_id: trxId ?? null, updated_at: new Date().toISOString() })
            .eq('qrc_id', qrcId);
          action = 'granted';
        } else {
          action = `status_${status}`;
        }
      }
    } catch (e) {
      console.error('[tochka webhook] processing failed', e);
      action = 'error';
    }
  }

  try {
    await admin.from('tochka_webhook_log').insert({
      content_type: headers['content-type'] ?? null,
      headers,
      body: body.slice(0, 8000),
      parsed_qrc_id: qrcId ?? null,
      action,
    });
  } catch (e) {
    console.error('[tochka webhook] log insert failed', e);
  }

  return NextResponse.json({ result: true });
}
