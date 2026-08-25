// Sber ID (OIDC) identity provider.
//
// Flow (authorization-code, user-facing redirect):
//   1. startVerification() builds the Sber ID authorize URL → returned as redirectUrl.
//   2. Sber redirects back to /api/identity/callback?code=…&state=…
//   3. completeSberCallback() exchanges the code, reads the user's profile
//      (sub + verified name), and returns a VerificationResult.
//
// Scope: "openid name" — we request ONLY the stable subject id and the verified
// legal name. No birthdate, no passport/ИНН/СНИЛС.
//
// IMPORTANT (onboarding): Sber ID endpoints, and whether the token/userinfo calls
// require an RqUID header and/or a client TLS certificate (mTLS), depend on your
// Sber B2B onboarding + sandbox vs production. All endpoints are env-overridable
// so you can point them at the sandbox first. Confirm exact hosts/headers in the
// Sber ID docs for your app before go-live.
//
// Env: SBER_CLIENT_ID, SBER_CLIENT_SECRET, IDENTITY_REDIRECT_URL,
//      SBER_AUTHORIZE_URL, SBER_TOKEN_URL, SBER_USERINFO_URL (optional overrides)

import { randomBytes, randomUUID } from 'crypto';
import type { IdentityProvider, StartVerification, VerificationResult } from './index';
import { resolveRedirectUri } from './index';

const DEFAULTS = {
  authorize: 'https://online.sberbank.ru/CSAFront/oidc/authorize.do',
  token: 'https://api.sberbank.ru/ru/prod/tokens/v3/oidc',
  userinfo: 'https://api.sberbank.ru/ru/prod/sberbankid/v2.1/userInfo',
};

const SCOPE = 'openid name';

function endpoints() {
  return {
    authorize: process.env.SBER_AUTHORIZE_URL ?? DEFAULTS.authorize,
    token: process.env.SBER_TOKEN_URL ?? DEFAULTS.token,
    userinfo: process.env.SBER_USERINFO_URL ?? DEFAULTS.userinfo,
  };
}

function requireCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SBER_CLIENT_ID;
  const clientSecret = process.env.SBER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Sber ID credentials missing (SBER_CLIENT_ID / SBER_CLIENT_SECRET)');
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

export async function completeSberCallback(code: string, baseUrl?: string): Promise<VerificationResult> {
  const { clientId, clientSecret } = requireCreds();
  const ep = endpoints();
  const redirectUri = resolveRedirectUri(baseUrl);

  const tokenRes = await fetch(ep.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      RqUID: randomUUID().replace(/-/g, ''),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPE,
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text().catch(() => '');
    throw new Error(`Sber token exchange failed: ${tokenRes.status} ${t}`);
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error('Sber token response had no access_token');

  const infoRes = await fetch(ep.userinfo, {
    headers: { Authorization: `Bearer ${token.access_token}`, RqUID: randomUUID().replace(/-/g, '') },
  });
  if (!infoRes.ok) {
    const t = await infoRes.text().catch(() => '');
    throw new Error(`Sber userinfo failed: ${infoRes.status} ${t}`);
  }
  const info = (await infoRes.json()) as Record<string, unknown>;
  const sub = typeof info.sub === 'string' ? info.sub : undefined;
  if (!sub) throw new Error('Sber userinfo had no sub');

  return {
    status: 'verified',
    providerSub: sub,
    ...(fullNameFrom(info) ? { fullName: fullNameFrom(info) } : {}),
    idType: 'sber_id',
    issuingCountry: 'RU',
  };
}

export class SberIdentityProvider implements IdentityProvider {
  async startVerification(_userId: string, baseUrl?: string): Promise<StartVerification> {
    const { clientId } = requireCreds();
    const state = randomBytes(24).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    const url = new URL(endpoints().authorize);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', resolveRedirectUri(baseUrl));
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    return { vendorRef: state, redirectUrl: url.toString() };
  }

  async processResult(vendorRef: string): Promise<VerificationResult> {
    return { status: 'pending', vendorRef };
  }
}
