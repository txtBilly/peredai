import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { mintSessionForEmail } from '@/lib/auth-session';
import { identityKeyFor, isProviderEnabled, getIdentityProvider } from '@/lib/identity';
import { isLocale, defaultLocale } from '@/i18n/config';

// Log in with a bank identity (Sber ID / T-ID), or the mock provider in preview.
//
// Mock (preview): there is no real IdP, so the user supplies the email they
// signed up with; we recompute the mock identity key, find the matching verified
// account, and mint its session inline.
//
// Real providers: return a redirectUrl to the hosted flow. The shared OAuth
// callback (/api/identity/callback) sees the `t2t_login_<state>` cookie, resolves
// the account by the bank `sub`, and mints the session there.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { provider?: string; email?: string; locale?: string };
  const provider = (body.provider ?? '').toLowerCase();
  const locale = typeof body.locale === 'string' && isLocale(body.locale) ? body.locale : defaultLocale;
  if (!isProviderEnabled(provider)) {
    return NextResponse.json({ error: 'provider_not_enabled' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (provider === 'mock') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 });
    const identityKey = identityKeyFor('mock', email);
    const { data: profile } = await admin
      .from('profiles')
      .select('email, verification_status')
      .eq('verified_identity_key', identityKey)
      .maybeSingle();
    if (!profile?.email || profile.verification_status !== 'verified') {
      return NextResponse.json({ error: 'no_account' }, { status: 404 });
    }
    const minted = await mintSessionForEmail(profile.email);
    if (!minted.ok) return NextResponse.json({ error: 'session_failed' }, { status: 500 });
    return NextResponse.json({ ok: true, next: `/${locale}/browse` });
  }

  // Bank provider: start the hosted OIDC flow. State (vendorRef) round-trips
  // through the bank; a short-lived cookie keyed by it marks this as a LOGIN so
  // the shared callback takes the "find account by sub → mint" path.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
  const baseUrl = host ? `${proto}://${host}` : undefined;
  const p = await getIdentityProvider(provider);
  const started = await p.startVerification(`login:${provider}`, baseUrl);
  const res = NextResponse.json({ status: 'pending', redirectUrl: started.redirectUrl });
  res.cookies.set(`t2t_login_${started.vendorRef}`, `${provider}|${locale}`, {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
