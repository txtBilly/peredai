import {
  tochkaBase,
  tochkaToken,
  probeConnectivity,
  probeAccounts,
  probeBalances,
  probeSbpLegalEntities,
  probeSbpMerchants,
  type TochkaResult,
} from '@/lib/tochka';

export const dynamic = 'force-dynamic';

// Staff-only connection diagnostic for the Tochka SBP integration. Read-only:
// it never moves money. It confirms the JWT works, shows which env vars are
// present (masked), and dumps the real API responses so we can lock in the exact
// accountId / merchant / legal-entity identifiers before building the QR flow.

function mask(v: string | undefined): string {
  if (!v) return '—';
  if (v.length <= 8) return `${'•'.repeat(Math.max(0, v.length - 2))}${v.slice(-2)} (len ${v.length})`;
  return `${v.slice(0, 4)}…${v.slice(-4)} (len ${v.length})`;
}

function StatusPill({ r }: { r: TochkaResult }) {
  const good = r.ok;
  const label = r.error ? `ERR ${r.error}` : `HTTP ${r.status}`;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        good ? 'bg-sage/20 text-sage' : 'bg-amber-500/15 text-amber-300'
      }`}
    >
      {good ? 'OK' : 'FAIL'} · {label}
    </span>
  );
}

function Probe({ title, path, r }: { title: string; path: string; r: TochkaResult }) {
  const body =
    r.json !== undefined ? JSON.stringify(r.json, null, 2) : r.text || r.error || '(empty)';
  return (
    <section className="rounded-xl border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base text-paper">{title}</h2>
          <p className="font-mono text-[11px] text-muted/70">GET {path}</p>
        </div>
        <StatusPill r={r} />
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-muted">
        {body}
      </pre>
    </section>
  );
}

export default async function AdminTochkaPage() {
  const token = tochkaToken();
  const legalId = process.env.TOCHKA_LEGAL_ID || 'LB0003583607';

  // Reachability first (no auth), then the authenticated probes. Run in parallel.
  // If there's no token, still run connectivity so we learn whether the host is
  // even reachable from this server.
  const noToken: TochkaResult = { ok: false, status: 0, error: 'no_token' };
  const [connectivity, accounts, balances, sbpLegal, sbpMerchants] = await Promise.all([
    probeConnectivity(),
    token ? probeAccounts() : Promise.resolve(noToken),
    token ? probeBalances() : Promise.resolve(noToken),
    token ? probeSbpLegalEntities() : Promise.resolve(noToken),
    token ? probeSbpMerchants(legalId) : Promise.resolve(noToken),
  ]);

  const env: Array<[string, string]> = [
    ['TOCHKA_API_TOKEN', mask(token)],
    ['TOCHKA_ACCOUNT_ID', process.env.TOCHKA_ACCOUNT_ID || '—'],
    ['TOCHKA_MERCHANT_ID', process.env.TOCHKA_MERCHANT_ID || '—'],
    ['TOCHKA_LEGAL_ID', process.env.TOCHKA_LEGAL_ID || '—'],
    ['TOCHKA_CLIENT_ID', process.env.TOCHKA_CLIENT_ID || '—'],
    ['TOCHKA_API_BASE', tochkaBase()],
    ['PAYMENTS_PROVIDER', process.env.PAYMENTS_PROVIDER || '(unset → mock)'],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-paper">Tochka · соединение</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Диагностика подключения к API Точки (только чтение — деньги не двигаются). Проверяет
          JWT-токен и показывает счета, юрлицо и мерчанта СБП, чтобы зафиксировать точные
          идентификаторы перед сборкой QR-оплаты.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 p-4">
        <h2 className="mb-3 font-display text-base text-paper">Переменные окружения</h2>
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-white/[0.06]">
            {env.map(([k, v]) => (
              <tr key={k}>
                <td className="py-2 pr-4 font-mono text-xs text-muted">{k}</td>
                <td className="py-2 font-mono text-xs text-paper">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted/70">
          Токен показан замаскированным (первые/последние 4 символа и длина) — полное значение
          нигде не выводится.
        </p>
      </section>

      <Probe title="Доступность хоста" path={`${tochkaBase().replace(/\/uapi$/, '')}/`} r={connectivity} />
      <Probe title="Счета" path="/open-banking/v1.0/accounts" r={accounts} />
      <Probe title="Балансы" path="/open-banking/v1.0/balances" r={balances} />
      <Probe title="СБП · юрлица" path="/sbp/v1.0/legal-entity" r={sbpLegal} />
      <Probe
        title="СБП · мерчанты"
        path={`/sbp/v1.0/merchant/legal-entity/${legalId}`}
        r={sbpMerchants}
      />
    </div>
  );
}
