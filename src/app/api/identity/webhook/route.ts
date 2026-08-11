// Identity verification webhook.
//
// Real provider (Stripe Identity): Stripe POSTs signed `identity.verification_session.*`
// events here. We verify the signature, resolve the user, read the verified
// outputs via the provider, and write the result.
//
// Mock/local: with no signing secret configured we accept a plain
// `{ vendor_ref }` body so the flow can be exercised without Stripe.
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { getIdentityProvider } from '@/lib/identity';
import { applyVerificationResult } from '@/lib/identity/apply';

export const runtime = 'nodejs';

const IDENTITY_WEBHOOK_SECRET = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const provider = await getIdentityProvider();

  // --- Real Stripe Identity path (signed) ---
  if (IDENTITY_WEBHOOK_SECRET) {
    const sig = req.headers.get('stripe-signature');
    if (!sig) return NextResponse.json({ error: 'no_signature' }, { status: 400 });

    const raw = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, IDENTITY_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[identity] signature verification failed', err);
      return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
    }

    if (!event.type.startsWith('identity.verification_session.')) {
      return NextResponse.json({ received: true }); // ignore unrelated events
    }

    const session = event.data.object as Stripe.Identity.VerificationSession;
    const vendorRef = session.id;
    // Prefer the user_id we stamped at start; fall back to the kyc_vendor_ref map.
    let userId = session.metadata?.user_id;
    if (!userId) {
      const { data } = await admin
        .from('profiles')
        .select('id')
        .eq('kyc_vendor_ref', vendorRef)
        .maybeSingle();
      userId = data?.id ?? undefined;
    }
    if (!userId) {
      console.error('[identity] could not resolve user for session', vendorRef);
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    const result = await provider.processResult(vendorRef);
    // 'processing' events carry no terminal result — nothing to write yet.
    if (result.status === 'pending') return NextResponse.json({ received: true });

    await applyVerificationResult(admin, userId, vendorRef, result);
    return NextResponse.json({ received: true });
  }

  // --- Mock/local path (unsigned) ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const vendorRef = (body as { vendor_ref?: string })?.vendor_ref;
  if (!vendorRef) return NextResponse.json({ error: 'missing_vendor_ref' }, { status: 400 });

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('kyc_vendor_ref', vendorRef)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  const result = await provider.processResult(vendorRef);
  await applyVerificationResult(admin, profile.id, vendorRef, result);
  return NextResponse.json({ ok: true });
}
