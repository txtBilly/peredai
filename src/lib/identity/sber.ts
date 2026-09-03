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
//      SBER_AUTHORIZE_URL, SBER_TOKEN_URL, SBER_USERINFO_URL (optional overrides),
//      SBER_CERT_P12_BASE64 + SBER_CERT_PASSWORD (client cert for mTLS, see below),
//      SBER_SCOPE (optional override, defaults to "openid name").

import { randomBytes, randomUUID } from 'crypto';
import https from 'node:https';
import type { IdentityProvider, StartVerification, VerificationResult } from './index';
import { resolveRedirectUri } from './index';

const DEFAULTS = {
  authorize: 'https://id.sber.ru/CSAFront/oidc/sberbank_id/authorize.do',
  token: 'https://oauth.sber.ru/ru/prod/tokens/v2/oidc',
  userinfo: 'https://oauth.sber.ru/ru/prod/sberbankid/v2.1/userinfo',
};

const SCOPE = process.env.SBER_SCOPE ?? 'openid name';
// Sber ID requires client_type on the authorize request: PRIVATE = individual
// (physical person). Missing it makes Sber reject the app with
// "Этот сервис не настроен для работы со Сбер ID". Overridable just in case.
const CLIENT_TYPE = process.env.SBER_CLIENT_TYPE ?? 'PRIVATE';

// Sber ID's backend endpoints (token exchange + userInfo) require mutual TLS: the
// server presents a client certificate issued to the application. We load it from
// a base64-encoded .p12 (PKCS#12) bundle in SBER_CERT_P12_BASE64, unlocked by
// SBER_CERT_PASSWORD, and pass it to Node's https as pfx/passphrase on those two
// calls. The cert is NEVER committed — it lives only in env (.env.local locally,
// encrypted env vars on the host). When the env is absent (e.g. mock/dev), the
// requests are plain HTTPS, so nothing breaks until it's configured.
let cachedPfx: Buffer | null | undefined;
function sberPfx(): Buffer | undefined {
  if (cachedPfx !== undefined) return cachedPfx ?? undefined;
  const b64 = process.env.SBER_CERT_P12_BASE64;
  cachedPfx = b64 ? Buffer.from(b64, 'base64') : null;
  return cachedPfx ?? undefined;
}

type HttpResult = { ok: boolean; status: number; body: string };

// Minimal HTTPS request with optional client certificate (mTLS). Used for the two
// server-to-server Sber calls; a client cert can't be attached to the global fetch
// (undici) without a dispatcher, whereas node:https takes pfx/passphrase directly.
function httpsRequest(
  urlStr: string,
  method: 'GET' | 'POST',
  headers: Record<string, string>,
  body?: string
): Promise<HttpResult> {
  const u = new URL(urlStr);
  const pfx = sberPfx();
  const passphrase = process.env.SBER_CERT_PASSWORD;
  const options: https.RequestOptions = {
    method,
    hostname: u.hostname,
    port: u.port || 443,
    path: `${u.pathname}${u.search}`,
    headers,
    ...(pfx ? { pfx, ...(passphrase ? { passphrase } : {}) } : {}),
  };
  return new Promise((resolve, reject) => {
    const request = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, body: data });
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

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

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
  }).toString();
  const tokenRes = await httpsRequest(ep.token, 'POST', {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    RqUID: randomUUID().replace(/-/g, ''),
  }, tokenBody);
  if (!tokenRes.ok) {
    throw new Error(`Sber token exchange failed: ${tokenRes.status} ${tokenRes.body}`);
  }
  const token = JSON.parse(tokenRes.body) as { access_token?: string };
  if (!token.access_token) throw new Error('Sber token response had no access_token');

  const infoRes = await httpsRequest(ep.userinfo, 'GET', {
    Authorization: `Bearer ${token.access_token}`,
    RqUID: randomUUID().replace(/-/g, ''),
  });
  if (!infoRes.ok) {
    throw new Error(`Sber userinfo failed: ${infoRes.status} ${infoRes.body}`);
  }
  const info = JSON.parse(infoRes.body) as Record<string, unknown>;
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
    // Sber ID rejects state/nonce longer than 64 chars. Keep both well under it:
    // state = 48 hex chars (matches Sber's own working example), nonce = 16.
    const state = randomBytes(24).toString('hex');
    const nonce = randomBytes(8).toString('hex');
    const url = new URL(endpoints().authorize);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_type', CLIENT_TYPE);
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
