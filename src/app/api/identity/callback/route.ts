import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { applyVerificationResult } from '@/lib/identity/apply';
import { completeOAuthCallback, identityKeyFor } from '@/lib/identity';
import { defaultLocale, isLocale } from '@/i18n/config';

export const runtime = 'nodejs';

// OAuth redirect target shared by all bank providers (Sber ID, T-ID; Yandex too
// if ever enabled). The user's browser lands here after authorizing. We look up
// which provider + user this `state` was issued for, exchange the code, read the
// verified profile, bind the identity, and write the result — then send the user
// back to the verify screen.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
  const appUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  const baseUrl = host ? `${proto}://${host}` : undefined;

  const admin = createAdminClient();

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
    if (userId && (oauthError || !code)) {
      await applyVerificationResult(admin, userId, state ?? 'unknown', {
        status: 'failed',
        failureReason: oauthError ?? 'no_code',
      });
    }
    return backTo(oauthError ? `&error=${encodeURIComponent(oauthError)}` : '');
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
