// IdentityProvider interface + factory.
//
// RU market: verification is via bank OAuth/OIDC — Sber ID and T-ID (T-Bank).
// Yandex ID exists in code but is intentionally NOT offered (self-asserted data
// is too weak for the anti-abuse / trust model). `mock` is the dev/preview
// provider that auto-verifies without any real credentials.
//
// Which providers are OFFERED on the verify screen is driven by
// NEXT_PUBLIC_IDENTITY_PROVIDERS (comma-separated), e.g. "mock" or "sber,tid".

import { createHmac } from 'crypto';

export type VerificationResult = {
  // 'pending' = provider is still processing (real vendors are async).
  status: 'verified' | 'failed' | 'pending';
  age?: number;           // derived from DOB if the provider returns it; never store full DOB
  vendorRef?: string;     // provider inquiry/session id
  failureReason?: string;
  fullName?: string;      // verified legal name (locked on the profile)
  idType?: string;        // provider tag, e.g. 'sber_id' | 'tid'
  idLast4?: string;
  issuingCountry?: string;
  // Stable per-user subject id from the provider (OIDC `sub`). Used to bind one
  // real identity to one account and to enforce bans across re-registration.
  providerSub?: string;
};

export type StartVerification = {
  vendorRef: string;
  /** Hosted-flow URL to redirect the user to (real providers). Absent for mock. */
  redirectUrl?: string;
};

export interface IdentityProvider {
  startVerification(userId: string, baseUrl?: string): Promise<StartVerification>;
  processResult(vendorRef: string): Promise<VerificationResult>;
}

// Providers offered to users on the verify screen (order preserved).
export function enabledIdentityProviders(): string[] {
  const raw = process.env.NEXT_PUBLIC_IDENTITY_PROVIDERS ?? 'mock';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isProviderEnabled(name: string): boolean {
  return enabledIdentityProviders().includes(name.toLowerCase());
}

// Factory — resolve a provider by explicit name (falls back to the first enabled).
export async function getIdentityProvider(name?: string): Promise<IdentityProvider> {
  const provider = (name ?? enabledIdentityProviders()[0] ?? 'mock').toLowerCase();
  if (provider === 'mock') {
    const { MockIdentityProvider } = await import('./mock');
    return new MockIdentityProvider();
  }
  if (provider === 'sber') {
    const { SberIdentityProvider } = await import('./sber');
    return new SberIdentityProvider();
  }
  if (provider === 'tid') {
    const { TidIdentityProvider } = await import('./tid');
    return new TidIdentityProvider();
  }
  if (provider === 'yandex') {
    const { YandexIdentityProvider } = await import('./yandex');
    return new YandexIdentityProvider();
  }
  throw new Error(`Unknown identity provider: ${provider}`);
}

// Complete an OAuth callback for a redirect-based provider: exchange the code,
// fetch the profile, and return a VerificationResult (with providerSub).
export async function completeOAuthCallback(
  provider: string,
  code: string,
  baseUrl?: string
): Promise<VerificationResult> {
  const p = provider.toLowerCase();
  if (p === 'sber') {
    const { completeSberCallback } = await import('./sber');
    return completeSberCallback(code, baseUrl);
  }
  if (p === 'tid') {
    const { completeTidCallback } = await import('./tid');
    return completeTidCallback(code, baseUrl);
  }
  if (p === 'yandex') {
    const { completeYandexCallback } = await import('./yandex');
    return completeYandexCallback(code, baseUrl);
  }
  throw new Error(`Provider ${provider} has no OAuth callback`);
}

// The OAuth redirect URI (shared callback for all providers). Must EXACTLY match
// the Callback URI registered on each provider's app. Prefer the explicit env.
export function resolveRedirectUri(baseUrl?: string): string {
  const explicit = process.env.IDENTITY_REDIRECT_URL;
  if (explicit) return explicit;
  if (baseUrl) return `${baseUrl.replace(/\/+$/, '')}/api/identity/callback`;
  return 'http://localhost:3000/api/identity/callback';
}

// Deterministic, non-reversible identity key = HMAC(secret, "provider:sub").
// One real identity → one key → one account. Bans bind to this key.
export function identityKeyFor(provider: string, sub: string): string {
  const secret = process.env.IDENTITY_KEY_SECRET ?? 'peredai-dev-identity-salt';
  return createHmac('sha256', secret).update(`${provider.toLowerCase()}:${sub}`).digest('hex');
}
