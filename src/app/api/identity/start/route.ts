import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getIdentityProvider } from '@/lib/identity';
import { applyVerificationResult } from '@/lib/identity/apply';

const PROVIDER = process.env.IDENTITY_PROVIDER ?? 'mock';

// Kicks off identity verification.
//   Stripe: creates a hosted VerificationSession and returns its URL; the
//           client redirects there and the webhook finalizes the result.
//   Mock:   there's no async webhook, so we process the outcome inline.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('verification_status')
    .eq('id', user.id)
    .single();
  if (profile?.verification_status === 'verified') {
    return NextResponse.json({ error: 'Already verified' }, { status: 400 });
  }

  const provider = await getIdentityProvider();

  // Resolve a vendor ref (+ hosted URL for real providers). A dev-only override
  // lets the mock simulate outcomes via ?mock=success|fail|underage.
  const mockOverride =
    PROVIDER === 'mock' && process.env.NODE_ENV === 'development'
      ? req.nextUrl.searchParams.get('mock')
      : null;

  let vendorRef: string;
  let redirectUrl: string | undefined;
  if (mockOverride) {
    vendorRef = `mock_${mockOverride}_${user.id.slice(0, 8)}_${Date.now()}`;
  } else {
    const started = await provider.startVerification(user.id);
    vendorRef = started.vendorRef;
    redirectUrl = started.redirectUrl;
  }

  await admin
    .from('profiles')
    .update({ verification_status: 'pending', kyc_vendor_ref: vendorRef })
    .eq('id', user.id);

  // Append-only audit row for this attempt.
  await admin.from('identity_documents').insert({
    user_id: user.id,
    kind: PROVIDER === 'stripe' ? 'stripe' : 'mock',
    vendor_ref: vendorRef,
    status: 'pending',
  });

  // Real provider: redirect to the hosted flow; the webhook finalizes.
  if (redirectUrl) {
    return NextResponse.json({ status: 'pending', redirectUrl });
  }

  // Mock: no webhook — process the outcome inline now.
  const result = await provider.processResult(vendorRef);
  await applyVerificationResult(admin, user.id, vendorRef, result);
  return NextResponse.json({ status: result.status, failureReason: result.failureReason });
}
