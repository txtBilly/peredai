// Yandex ID (OAuth 2.0) identity provider.
//
// Flow (authorization-code, user-facing redirect — NOT a webhook):
//   1. startVerification() builds the Yandex authorize URL and returns it as
//      `redirectUrl`. The client sends the user there.
//   2. Yandex redirects back to /api/identity/callback?code=…&state=…
//   3. The callback exchanges the code for a token, fetches the user's Yandex
//      profile (login.yandex.ru/info), maps it to a VerificationResult, and
//      calls applyVerificationResult().
//
// NOTE ON ASSURANCE LEVEL: Yandex ID confirms control of a Yandex account and
// returns the account's name (and birthday, if the `login:birthday` scope is
// granted). This is account-level identity, not passport-grade KYC. For a
// stronger legal-identity / 18+ guarantee, layer Gosuslugi/ЕСИА or a KYC vendor
// on top later. The 18+ gate here uses the birthday claim when available.
//
// Env: YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET, IDENTITY_REDIRECT_URL

import { randomBytes } from 'crypto';
import type { IdentityProvider, StartVerification, VerificationResult } from './index';

const AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize';
const TOKEN_URL = 'https://oauth.yandex.ru/token';
const INFO_URL = 'https://login.yandex.ru/info';

// `login:info` → name + default email; `login:birthday` → date of birth (for 18+).
const SCOPE = 'login:info login:birthday';

export type YandexUserInfo = {
  id: string;
  login?: string;
  display_name?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  default_email?: string;
  birthday?: string; // "YYYY-MM-DD" (parts may be "0000")
  is_avatar_empty?: boolean;
  sex?: string;
};

// The redirect URI must EXACTLY match the Callback URI registered on the Yandex
// OAuth app. Prefer the explicit env var; fall back to the request origin.
export function resolveRedirectUri(baseUrl?: string): string {
  const explicit = process.env.IDENTITY_REDIRECT_URL;
  if (explicit) return explicit;
  if (baseUrl) return `${baseUrl.replace(/\/+$/, '')}/api/identity/callback`;
  return 'http://localhost:3000/api/identity/callback';
}

function requireCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.YANDEX_CLIENT_ID;
  const clientSecret = process.env.YANDEX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Yandex OAuth credentials missing (YANDEX_CLIENT_ID / YANDEX_CLIENT_SECRET)');
  }
  return { clientId, clientSecret };
}

// Compute age from a Yandex birthday string; null if absent/unparseable.
export function ageFromBirthday(birthday?: string): number | null {
  if (!birthday) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!y || !mo || !d) return null; // Yandex uses 0000 for unknown parts
  const today = new Date();
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() + 1 < mo || (today.getUTCMonth() + 1 === mo && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

// Exchange an authorization code for an access token.
export async function exchangeCodeForToken(code: string): Promise<string> {
  const { clientId, clientSecret } = requireCreds();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Yandex token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Yandex token response had no access_token');
  return json.access_token;
}

// Fetch the authenticated user's Yandex profile.
export async function fetchUserInfo(accessToken: string): Promise<YandexUserInfo> {
  const res = await fetch(`${INFO_URL}?format=json`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Yandex userinfo failed: ${res.status} ${text}`);
  }
  return (await res.json()) as YandexUserInfo;
}

// Map a Yandex profile to our VerificationResult. Always 'verified' at the
// Yandex-account level; the 18+ gate is enforced downstream in
// applyVerificationResult using `age` when the birthday claim is present.
export function toVerificationResult(info: YandexUserInfo, vendorRef: string): VerificationResult {
  const fullName =
    info.real_name?.trim() ||
    [info.first_name, info.last_name].filter(Boolean).join(' ').trim() ||
    info.display_name?.trim() ||
    undefined;
  const age = ageFromBirthday(info.birthday);
  return {
    status: 'verified',
    vendorRef,
    providerSub: info.id,
    ...(fullName ? { fullName } : {}),
    ...(age != null ? { age } : {}),
    idType: 'yandex_id',
    idLast4: info.id ? info.id.slice(-4) : undefined,
    issuingCountry: 'RU',
  };
}

// Uniform OAuth-callback entrypoint (mirrors sber.ts / tid.ts).
export async function completeYandexCallback(code: string, _baseUrl?: string): Promise<VerificationResult> {
  const token = await exchangeCodeForToken(code);
  const info = await fetchUserInfo(token);
  return toVerificationResult(info, info.id);
}

export class YandexIdentityProvider implements IdentityProvider {
  async startVerification(userId: string, baseUrl?: string): Promise<StartVerification> {
    const { clientId } = requireCreds();
    // Opaque CSRF/state token; also our vendorRef. It's stored on the profile
    // (kyc_vendor_ref) at /api/identity/start so the callback can resolve the
    // user and validate the round-trip.
    const state = randomBytes(24).toString('hex');
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', resolveRedirectUri(baseUrl));
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('force_confirm', 'yes');
    return { vendorRef: state, redirectUrl: url.toString() };
  }

  // Not used in the OAuth callback path (the callback does the token exchange
  // directly). Present to satisfy the IdentityProvider interface.
  async processResult(vendorRef: string): Promise<VerificationResult> {
    return { status: 'pending', vendorRef };
  }
}
