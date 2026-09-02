import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { applyVerificationResult } from '@/lib/identity/apply';
import { completeOAuthCallback, identityKeyFor } from '@/lib/identity';
import { mintSessionForEmail } from '@/lib/auth-session';
import { defaultLocale, isLocale } from '@/i18n/config';

export const runtime = 'nodejs';

// Shared OAuth redirect target for all bank providers (Sber ID, T-ID). Handles
// two purposes, told apart by a `t2t_login_<state>` cookie set at /api/auth/login:
//   • LOGIN  — no prior session; resolve the account by the bank `sub` and mint
//              its session.
//   • VERIFY — an already-logged-in user is verifying; bind the identity + name.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
  const appUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  const baseUrl = host ? `${proto}://${host}` : undefined;

  // Diagnostic: confirm the callback is reached and what the bank returned.
  console.log('[identity] callback hit', {
    hasCode: !!code,
    hasState: !!state,
    oauthError: oauthError ?? null,
  });

  const admin = createAdminClient();

  // ---- LOGIN branch --------------------------------------------------------
  const loginCookie = state ? req.cookies.get(`t2t_login_${state}`)?.value : undefined;
  if (loginCookie) {
    const [loginProvider, cookieLocale] = loginCookie.split('|');
    const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
    const done = (path: string) => {
      const res = NextResponse.redirect(`${appUrl}${path}`, 303);
      res.cookies.set(`t2t_login_${state}`, '', { maxAge: 0, path: '/' });
      return res;
    };
    if (oauthError || !code || !state) {
      return done(`/${locale}/signin?error=${encodeURIComponent(oauthError ?? 'no_code')}`);
    }
    try {
      const result = await completeOAuthCallback(loginProvider, code, baseUrl);
      if (result.status !== 'verified' || !result.providerSub) {
        return done(`/${locale}/signin?error=login_failed`);
      }
      const identityKey = identityKeyFor(loginProvider, result.providerSub);
      const { data: profile } = await admin
        .from('profiles')
        .select('email, verification_status')
        .eq('verified_identity_key', identityKey)
        .maybeSingle();
      if (!profile?.email || profile.verification_status !== 'verified') {
        return done(`/${locale}/signin?error=no_account`);
      }
      const minted = await mintSessionForEmail(profile.email);
      if (!minted.ok) return done(`/${locale}/signin?error=session_failed`);
      return done(`/${locale}/browse`);
    } catch (e) {
      console.error('[auth/login] callback failed', e);
      return done(`/${locale}/signin?error=provider_error`);
    }
  }

  // ---- VERIFY branch -------------------------------------------------------
  // Resolve the user + provider this state was issued for (set at /identity/start).
  let userId: string | undefined;
  let provider: string | undefined;
  if (state) {
    const { data: doc } = await admin
      .from('identity_documents')
      .select('user_id, kind')
      .eq('vendor_ref', state)
      .order('created_at', { ascending: false })
      .maybeSingle();
    userId = doc?.user_id;
    provider = doc?.kind;
  }

  let locale: string = defaultLocale;
  if (userId) {
    const { data: p } = await admin.from('profiles').select('preferred_locale').eq('id', userId).maybeSingle();
    if (p?.preferred_locale && isLocale(p.preferred_locale)) locale = p.preferred_locale;
  }

  const backTo = (params: string) =>
    NextResponse.redirect(`${appUrl}/${locale}/verify?return=1${params}`, 303);

  if (oauthError || !code || !state || !userId || !provider) {
    const reason =
      oauthError || (!code ? 'no_code' : !state ? 'no_state' : !userId ? 'state_unresolved' : 'no_provider');
    console.error('[identity] verify callback could not proceed', {
      hasCode: !!code,
      hasState: !!state,
      resolvedUserId: userId ?? null,
      provider: provider ?? null,
      oauthError: oauthError ?? null,
      reason,
    });
    // Record the failure when we know whose attempt it was, so the profile
    // doesn't stay stuck at 'pending' (which would spin the verify screen).
    if (userId) {
      await applyVerificationResult(admin, userId, state ?? 'unknown', {
        status: 'failed',
        failureReason: reason,
      });
    }
    return backTo(`&error=${encodeURIComponent(reason)}`);
  }

  // CSRF defense-in-depth: a present session must match the state's user.
  try {
    const supabase = createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    if (sessionUser && sessionUser.id !== userId) return backTo('&error=session_mismatch');
  } catch {
    // No/invalid session — state binding is the primary check.
  }

  try {
    const result = await completeOAuthCallback(provider, code, baseUrl);
    const identityKey = result.providerSub ? identityKeyFor(provider, result.providerSub) : undefined;
    await applyVerificationResult(admin, userId, state, result, identityKey);
  } catch (e) {
    console.error(`[identity] ${provider} callback failed`, e);
    await applyVerificationResult(admin, userId, state, {
      status: 'failed',
      failureReason: 'provider_error',
    });
    return backTo('&error=provider_error');
  }

  return backTo('');
}
