import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  getIdentityProvider,
  isProviderEnabled,
  enabledIdentityProviders,
  identityKeyFor,
} from '@/lib/identity';
import { applyVerificationResult } from '@/lib/identity/apply';

// Kicks off identity verification with a chosen provider.
//   Body: { provider?: 'sber' | 'tid' | 'mock', mock?: 'success'|'fail'|'underage' }
//   Bank providers (sber/tid): returns a hosted-flow redirectUrl; the callback
//   (/api/identity/callback) finalizes the result.
//   Mock: processed inline (no webhook), for preview/dev.
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

  const body = (await req.json().catch(() => ({}))) as { provider?: string; mock?: string };
  const requested = (body.provider ?? enabledIdentityProviders()[0] ?? 'mock').toLowerCase();
  if (!isProviderEnabled(requested)) {
    return NextResponse.json({ error: 'provider_not_enabled' }, { status: 400 });
  }

  const provider = await getIdentityProvider(requested);

  // Dev-only mock outcome override.
  const mockOverride =
    requested === 'mock' && process.env.NODE_ENV === 'development' ? body.mock ?? null : null;

  let vendorRef: string;
  let redirectUrl: string | undefined;
  if (mockOverride) {
    vendorRef = `mock_${mockOverride}_${user.id.slice(0, 8)}_${Date.now()}`;
  } else {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
    const baseUrl = host ? `${proto}://${host}` : undefined;
    const started = await provider.startVerification(user.id, baseUrl);
    vendorRef = started.vendorRef;
    redirectUrl = started.redirectUrl;
  }

  await admin
    .from('profiles')
    .update({ verification_status: 'pending', kyc_vendor_ref: vendorRef })
    .eq('id', user.id);

  // Append-only audit row; `kind` records which provider this attempt used so the
  // callback can dispatch the token exchange to the right provider.
  await admin.from('identity_documents').insert({
    user_id: user.id,
    kind: requested,
    vendor_ref: vendorRef,
    status: 'pending',
  });

  // Bank provider: redirect to the hosted flow; the callback finalizes + binds.
  if (redirectUrl) {
    return NextResponse.json({ status: 'pending', redirectUrl });
  }

  // Mock: process inline. Bind the mock identity to the account's EMAIL (not the
  // user id) so that "log in with mock" — which only knows the email — resolves
  // back to this same account. Real providers bind the bank `sub` instead.
  const result = await provider.processResult(vendorRef);
  const identityKey = identityKeyFor('mock', (user.email ?? user.id).toLowerCase());
  await applyVerificationResult(admin, user.id, vendorRef, result, identityKey);
  return NextResponse.json({ status: result.status, failureReason: result.failureReason });
}
