import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { getQrPaymentStatus } from '@/lib/tochka';
import { grantPurchaseCredits } from '@/lib/credits';
import { recordRedemption } from '@/lib/coupons';

export const runtime = 'nodejs';

// Inbound Tochka webhook. The body is a signed JWT (JWS, RS256) whose payload is
// the incomingSbpPayment event: { qrcId, operationId, amount, webhookType, … }.
//
// Trust model, in order:
//   1. If TOCHKA_WEBHOOK_PUBLIC_KEY is set, verify the RS256 signature and reject
//      anything that fails (a forged/tampered POST is dropped before processing).
//   2. Regardless, the grant is re-confirmed against Tochka's payment-status API
//      before any token is issued — so even an unverified event can't grant on
//      its own say-so.
//   3. The grant is idempotent (credit_ledger key = tochka_<qrcId>), so it's safe
//      alongside the /pay/qr poller.
// Every delivery is logged to tochka_webhook_log for inspection.

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.trim().split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(b64urlToBuf(parts[1]).toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Load the configured webhook public key. Accepts either a JWK (JSON object, as
// Tochka publishes it) or a PEM string.
function loadPublicKey(raw: string): crypto.KeyObject | string | null {
  const s = raw.trim();
  if (s.startsWith('{')) {
    try {
      return crypto.createPublicKey({ key: JSON.parse(s), format: 'jwk' });
    } catch {
      return null;
    }
  }
  return s; // PEM
}

// RS256 (RSASSA-PKCS1-v1_5 + SHA-256) verification of a compact JWS.
function verifyRs256(token: string, key: crypto.KeyObject | string): boolean {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  try {
    const v = crypto.createVerify('RSA-SHA256');
    v.update(`${parts[0]}.${parts[1]}`);
    v.end();
    return v.verify(key, b64urlToBuf(parts[2]));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text().catch(() => '');
  const admin = createAdminClient();

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });

  const isJwt = body.trim().split('.').length === 3;
  const claims = decodeJwtPayload(body);
  const qrcId = (typeof claims?.qrcId === 'string' && claims.qrcId) || undefined;
  const webhookType = typeof claims?.webhookType === 'string' ? claims.webhookType : undefined;

  // Signature check (opt-in via env). When a key is configured, a bad signature
  // is dropped without processing.
  const pubKeyRaw = process.env.TOCHKA_WEBHOOK_PUBLIC_KEY;
  let sig: 'verified' | 'invalid' | 'unverified' = 'unverified';
  if (pubKeyRaw && isJwt) {
    const key = loadPublicKey(pubKeyRaw);
    sig = key ? (verifyRs256(body, key) ? 'verified' : 'invalid') : 'unverified';
  }

  const log = (action: string, parsedQrc?: string) =>
    admin
      .from('tochka_webhook_log')
      .insert({
        content_type: headers['content-type'] ?? null,
        headers,
        body: body.slice(0, 8000),
        parsed_qrc_id: parsedQrc ?? null,
        action: `${action}·sig=${sig}`,
      })
      .then(
        () => undefined,
        (e) => console.error('[tochka webhook] log insert failed', e)
      );

  if (sig === 'invalid') {
    await log('bad_signature', qrcId);
    return NextResponse.json({ result: true });
  }
  if (!qrcId || (webhookType && webhookType !== 'incomingSbpPayment')) {
    await log(qrcId ? `ignored_type_${webhookType}` : 'no_qrc', qrcId);
    return NextResponse.json({ result: true });
  }

  let action = 'captured';
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

  await log(action, qrcId);
  return NextResponse.json({ result: true });
}
