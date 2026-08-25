// T-ID (T-Bank / Tinkoff ID, OIDC) identity provider.
//
// Flow (authorization-code, user-facing redirect):
//   1. startVerification() builds the T-ID authorize URL → returned as redirectUrl.
//   2. T-ID redirects back to /api/identity/callback?code=…&state=…
//   3. completeTidCallback() exchanges the code, reads the user's profile
//      (sub + verified name), and returns a VerificationResult.
//
// Scope: "openid name" — stable subject id + verified legal name only. No DOB.
//
// Endpoints are the documented T-ID hosts and are env-overridable for the
// sandbox. Onboarding is via tinkoff_id@tinkoff.ru (partner application).
//
// Env: TID_CLIENT_ID, TID_CLIENT_SECRET, IDENTITY_REDIRECT_URL,
//      TID_AUTHORIZE_URL, TID_TOKEN_URL, TID_USERINFO_URL (optional overrides)

import { randomBytes } from 'crypto';
import type { IdentityProvider, StartVerification, VerificationResult } from './index';
import { resolveRedirectUri } from './index';

const DEFAULTS = {
  authorize: 'https://id.tinkoff.ru/auth/authorize',
  token: 'https://id.tinkoff.ru/auth/token',
  userinfo: 'https://id.tinkoff.ru/userinfo/userinfo',
};

const SCOPE = 'openid name';

function endpoints() {
  return {
    authorize: process.env.TID_AUTHORIZE_URL ?? DEFAULTS.authorize,
    token: process.env.TID_TOKEN_URL ?? DEFAULTS.token,
    userinfo: process.env.TID_USERINFO_URL ?? DEFAULTS.userinfo,
  };
}

function requireCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.TID_CLIENT_ID;
  const clientSecret = process.env.TID_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('T-ID credentials missing (TID_CLIENT_ID / TID_CLIENT_SECRET)');
  }
  return { clientId, clientSecret };
}

function fullNameFrom(info: Record<string, unknown>): string | undefined {
  const parts = [info.family_name, info.given_name, info.middle_name]
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim());
  if (parts.length) return parts.join(' ');
  return typeof info.name === 'string' ? info.name.trim() : undefined;
}

export async function completeTidCallback(code: string, baseUrl?: string): Promise<VerificationResult> {
  const { clientId, clientSecret } = requireCreds();
  const ep = endpoints();
  const redirectUri = resolveRedirectUri(baseUrl);

  const tokenRes = await fetch(ep.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text().catch(() => '');
    throw new Error(`T-ID token exchange failed: ${tokenRes.status} ${t}`);
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error('T-ID token response had no access_token');

  const infoRes = await fetch(ep.userinfo, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ access_token: token.access_token }),
  });
  if (!infoRes.ok) {
    const t = await infoRes.text().catch(() => '');
    throw new Error(`T-ID userinfo failed: ${infoRes.status} ${t}`);
  }
  const info = (await infoRes.json()) as Record<string, unknown>;
  const sub = typeof info.sub === 'string' ? info.sub : undefined;
  if (!sub) throw new Error('T-ID userinfo had no sub');

  return {
    status: 'verified',
    providerSub: sub,
    ...(fullNameFrom(info) ? { fullName: fullNameFrom(info) } : {}),
    idType: 'tid',
    issuingCountry: 'RU',
  };
}

export class TidIdentityProvider implements IdentityProvider {
  async startVerification(_userId: string, baseUrl?: string): Promise<StartVerification> {
    const { clientId } = requireCreds();
    const state = randomBytes(24).toString('hex');
    const url = new URL(endpoints().authorize);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', resolveRedirectUri(baseUrl));
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    return { vendorRef: state, redirectUrl: url.toString() };
  }

  async processResult(vendorRef: string): Promise<VerificationResult> {
    return { status: 'pending', vendorRef };
  }
}
