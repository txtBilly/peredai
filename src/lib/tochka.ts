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

import https from 'node:https';
import tls from 'node:tls';
import { RUSSIAN_TRUSTED_ROOT_CA, RUSSIAN_TRUSTED_SUB_CA } from './russianTrustedCa';

const DEFAULT_BASE = 'https://enter.tochka.com/uapi';

// enter.tochka.com serves a TLS cert chaining to the Russian Trusted Root CA,
// which Node doesn't bundle. We trust it IN ADDITION to the standard CA bundle,
// and only for these outbound requests — full verification stays on (no
// rejectUnauthorized:false). Setting `ca` replaces the defaults, so we
// concatenate the built-in roots with the two Russian certs.
const TOCHKA_CA: string[] = [...tls.rootCertificates, RUSSIAN_TRUSTED_ROOT_CA, RUSSIAN_TRUSTED_SUB_CA];

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

// undici (Node's fetch) collapses every network-level failure into the opaque
// "fetch failed". The real reason lives on error.cause (and sometimes a nested
// AggregateError). Surface it so we can tell a geo/connection block (ECONNRESET,
// ETIMEDOUT, ECONNREFUSED) from a TLS trust problem (CERT_*/self-signed) from a
// DNS miss (ENOTFOUND).
export function describeError(e: unknown): string {
  let msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const topCode = (e as { code?: string } | null)?.code;
  if (topCode) msg += ` (${topCode})`;
  const cause = (e as { cause?: unknown } | null)?.cause;
  if (cause) {
    if (cause instanceof Error) {
      const code = (cause as { code?: string }).code;
      msg += ` — cause: ${cause.message}${code ? ` (${code})` : ''}`;
      const inner = (cause as { errors?: unknown[] }).errors;
      if (Array.isArray(inner)) {
        msg += ` [${inner
          .map((x) =>
            x instanceof Error
              ? `${x.message}${(x as { code?: string }).code ? ` (${(x as { code?: string }).code})` : ''}`
              : String(x)
          )
          .join('; ')}]`;
      }
    } else {
      msg += ` — cause: ${String(cause)}`;
    }
  }
  return msg;
}

// Core request over node:https so we can pin the Russian Trusted CA (Node's
// global fetch/undici can't take a per-request CA without an extra dependency).
// Never throws — always resolves a TochkaResult so callers and the diagnostic
// page can render the real status/body, including network errors.
function tochkaRequest(
  urlStr: string,
  opts: { method?: string; body?: unknown; withAuth?: boolean; timeoutMs?: number } = {}
): Promise<TochkaResult> {
  const { method = 'GET', body, withAuth = true, timeoutMs = 15000 } = opts;
  return new Promise<TochkaResult>((resolve) => {
    let u: URL;
    try {
      u = new URL(urlStr);
    } catch {
      resolve({ ok: false, status: 0, error: `bad_url: ${urlStr}` });
      return;
    }
    const token = tochkaToken();
    const payload = body === undefined ? undefined : JSON.stringify(body);

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method,
        ca: TOCHKA_CA, // trust Russian Trusted CA + defaults; verification stays ON
        headers: {
          Accept: 'application/json',
          ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 0;
          let json: unknown;
          try {
            json = raw ? JSON.parse(raw) : undefined;
          } catch {
            /* non-JSON — keep as text */
          }
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json,
            text: json === undefined ? raw.slice(0, 2000) : undefined,
          });
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`request timeout after ${timeoutMs}ms`)));
    req.on('error', (e) => resolve({ ok: false, status: 0, error: describeError(e) }));
    if (payload) req.write(payload);
    req.end();
  });
}

// Low-level API request against the configured base URL (authenticated).
export function tochkaFetch(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<TochkaResult> {
  if (!tochkaToken()) return Promise.resolve({ ok: false, status: 0, error: 'no_token' });
  const url = `${tochkaBase()}${path.startsWith('/') ? path : `/${path}`}`;
  return tochkaRequest(url, { method: init?.method, body: init?.body });
}

// Raw reachability check to the Tochka host — NO auth, NO API path — just "can
// this server open a (now CA-trusted) TLS connection to enter.tochka.com". Any
// HTTP status back (even 404) proves reachability + TLS trust.
export async function probeConnectivity(): Promise<TochkaResult> {
  const base = new URL(tochkaBase());
  const r = await tochkaRequest(`${base.protocol}//${base.host}/`, { withAuth: false });
  if (r.status > 0) return { ...r, ok: true, text: `reachable — HTTP ${r.status}` };
  return r;
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
