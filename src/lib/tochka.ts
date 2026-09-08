// Tochka (Точка) Open Banking API client. Auth is a permanent JWT issued in the
// Tochka developer cabinet, sent as a Bearer token. Used for SBP (СБП) dynamic
// QR-code payments and, later, webhook management + fiscalization via Точка Касса.
//
// Base URL defaults to production; override with TOCHKA_API_BASE.
//
// Env (all server-only):
//   TOCHKA_API_TOKEN   — JWT bearer token (secret)
//   TOCHKA_API_BASE    — override base URL (default https://enter.tochka.com/uapi)
//   TOCHKA_ACCOUNT_ID  — settlement account that receives SBP funds ("account/BIC")
//   TOCHKA_MERCHANT_ID — SBP merchant id (MA…)
//   TOCHKA_LEGAL_ID    — SBP legal-entity id (LB…)
//   TOCHKA_CLIENT_ID   — application (client) id, for webhook management

const DEFAULT_BASE = 'https://enter.tochka.com/uapi';

export function tochkaBase(): string {
  return (process.env.TOCHKA_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
}

// Accept a couple of aliases so a slightly different Vercel var name still works;
// the diagnostic page reports which one was actually found.
export function tochkaToken(): string | undefined {
  return (
    process.env.TOCHKA_API_TOKEN ||
    process.env.TOCHKA_JWT_TOKEN ||
    process.env.TOCHKA_JWT ||
    undefined
  );
}

export type TochkaResult = {
  ok: boolean;
  status: number;
  json?: unknown;
  text?: string;
  error?: string;
};

// Low-level request. Never throws — always returns a TochkaResult so callers
// (and the diagnostic page) can render the real status/body, including errors.
export async function tochkaFetch(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<TochkaResult> {
  const token = tochkaToken();
  if (!token) return { ok: false, status: 0, error: 'no_token' };

  const url = `${tochkaBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      signal: controller.signal,
      cache: 'no-store',
    });
    const raw = await res.text();
    let json: unknown;
    try {
      json = raw ? JSON.parse(raw) : undefined;
    } catch {
      /* non-JSON response — keep as text below */
    }
    return {
      ok: res.ok,
      status: res.status,
      json,
      text: json === undefined ? raw.slice(0, 2000) : undefined,
    };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// --- Read-only probes for the connection diagnostic ---
// These confirm the token is valid and reveal the exact identifiers Tochka
// expects (accountId format, SBP legal-entity + merchant ids) before we build
// the QR flow on top of them. Paths follow the documented service layout; any
// that come back non-2xx are surfaced verbatim so we can correct the shape.

export function probeAccounts(): Promise<TochkaResult> {
  return tochkaFetch('/open-banking/v1.0/accounts');
}
export function probeBalances(): Promise<TochkaResult> {
  return tochkaFetch('/open-banking/v1.0/balances');
}
export function probeSbpLegalEntities(): Promise<TochkaResult> {
  return tochkaFetch('/sbp/v1.0/legal-entity');
}
export function probeSbpMerchants(legalId: string): Promise<TochkaResult> {
  return tochkaFetch(`/sbp/v1.0/merchant/legal-entity/${encodeURIComponent(legalId)}`);
}
