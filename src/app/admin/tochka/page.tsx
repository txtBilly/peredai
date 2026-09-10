import {
  tochkaBase,
  tochkaToken,
  probeConnectivity,
  probeAccounts,
  probeBalances,
  probeSbpMerchants,
  getWebhooks,
  type TochkaResult,
} from '@/lib/tochka';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Staff-only ops panel for the Tochka SBP integration. Read-only probes confirm
// the JWT/identifiers; the Webhooks section lets us register our endpoint, fire a
// test delivery, and inspect exactly what Tochka POSTs to us (captured live).

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

function Probe({ title, path, method = 'GET', r }: { title: string; path: string; method?: string; r: TochkaResult }) {
  const body = r.json !== undefined ? JSON.stringify(r.json, null, 2) : r.text || r.error || '(empty)';
  return (
    <section className="rounded-xl border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base text-paper">{title}</h2>
          <p className="font-mono text-[11px] text-muted/70">
            {method} {path}
          </p>
        </div>
        <StatusPill r={r} />
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-muted">
        {body}
      </pre>
    </section>
  );
}

type WebhookLogRow = {
  received_at: string;
  action: string | null;
  parsed_qrc_id: string | null;
  content_type: string | null;
  body: string | null;
};

const WH_MESSAGES: Record<string, string> = {
  registered: 'Вебхук зарегистрирован на /api/tochka/webhook.',
  test_sent: 'Тестовое событие отправлено — обновите страницу, оно появится в журнале ниже.',
  unknown_action: 'Неизвестное действие.',
  acquiring_ok: 'Тест эквайринга прошёл — ссылка на оплату создана. Смотрите ответ в журнале ниже.',
  acquiring_err: 'Тест эквайринга не прошёл — смотрите ошибку в журнале ниже (нужен эквайринг + право MakeAcquiringOperation).',
  receipt_checked: 'Данные последнего платежа записаны в журнал ниже — разверните строку receipt_check и посмотрите, есть ли в ответе блок чека/ОФД.',
  receipt_none: 'Нет ни одного проведённого платежа с operationId, чтобы проверить чек.',
};

export default async function AdminTochkaPage({
  searchParams,
}: {
  searchParams: { wh?: string };
}) {
  const token = tochkaToken();
  const legalId = process.env.TOCHKA_LEGAL_ID || 'LB0003583607';
  const admin = createAdminClient();

  const [connectivity, accounts, balances, sbpMerchants, webhooks, whLogRes] = await Promise.all([
    probeConnectivity(),
    token ? probeAccounts() : Promise.resolve<TochkaResult>({ ok: false, status: 0, error: 'no_token' }),
    token ? probeBalances() : Promise.resolve<TochkaResult>({ ok: false, status: 0, error: 'no_token' }),
    token ? probeSbpMerchants(legalId) : Promise.resolve<TochkaResult>({ ok: false, status: 0, error: 'no_token' }),
    token ? getWebhooks() : Promise.resolve<TochkaResult>({ ok: false, status: 0, error: 'no_token' }),
    admin
      .from('tochka_webhook_log')
      .select('received_at, action, parsed_qrc_id, content_type, body')
      .order('received_at', { ascending: false })
      .limit(8),
  ]);
  const whLog = (whLogRes.data as WebhookLogRow[] | null) ?? [];

  const whNote = searchParams.wh
    ? WH_MESSAGES[searchParams.wh] ??
      (searchParams.wh.startsWith('error_') ? `Ошибка API: ${searchParams.wh.replace('error_', 'HTTP ')}` : null)
    : null;

  const env: Array<[string, string]> = [
    ['TOCHKA_API_TOKEN', mask(token)],
    ['TOCHKA_ACCOUNT_ID', process.env.TOCHKA_ACCOUNT_ID || '— (авто-определение)'],
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
          Панель интеграции СБП с Точкой. Проверка токена и идентификаторов (только чтение), плюс
          управление вебхуками и журнал входящих уведомлений.
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
      <Probe title="СБП · мерчанты" path={`/sbp/v1.0/merchant/legal-entity/${legalId}`} r={sbpMerchants} />

      {/* --- Webhooks --- */}
      <section className="rounded-xl border border-white/10 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base text-paper">Вебхуки · подписка</h2>
            <p className="font-mono text-[11px] text-muted/70">GET /webhook/v1.0/{'{clientId}'}</p>
          </div>
          <StatusPill r={webhooks} />
        </div>

        {whNote && (
          <p className="mb-3 rounded-lg bg-sage/15 px-3 py-2 text-xs text-sage">{whNote}</p>
        )}

        <pre className="max-h-56 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-muted">
          {webhooks.json !== undefined
            ? JSON.stringify(webhooks.json, null, 2)
            : webhooks.text || webhooks.error || '(empty)'}
        </pre>

        <div className="mt-3 flex flex-wrap gap-3">
          <form action="/api/admin/tochka/webhook" method="post">
            <input type="hidden" name="action" value="register" />
            <button
              type="submit"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper hover:bg-white/[0.06]"
            >
              Зарегистрировать вебхук (/api/tochka/webhook)
            </button>
          </form>
          <form action="/api/admin/tochka/webhook" method="post">
            <input type="hidden" name="action" value="test" />
            <button
              type="submit"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper hover:bg-white/[0.06]"
            >
              Отправить тестовое событие
            </button>
          </form>
        </div>
        <p className="mt-2 text-[11px] text-muted/70">
          «Зарегистрировать» подписывает наш URL на событие incomingSbpPayment. «Тестовое событие»
          просит Точку прислать пример — он появится в журнале ниже (обновите страницу).
        </p>
      </section>

      {/* --- Acquiring (fiscal receipt) test --- */}
      <section className="rounded-xl border border-white/10 p-4">
        <h2 className="font-display text-base text-paper">Эквайринг · тест чека</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted">
          Создаёт одну реальную (неоплаченную) ссылку на оплату с чеком через
          /acquiring/v1.0/payments_with_receipt — проверяет, что интернет-эквайринг подключён и у
          токена есть право MakeAcquiringOperation. Деньги не двигаются; ответ появится в журнале
          ниже. Если оплатить ссылку, тестовый чек придёт на ваш staff-email.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <form action="/api/admin/tochka/acquiring-test" method="post">
            <button
              type="submit"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper hover:bg-white/[0.06]"
            >
              Создать тестовый платёж с чеком (10 ₽)
            </button>
          </form>
          <form action="/api/admin/tochka/receipt-check" method="post">
            <button
              type="submit"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper hover:bg-white/[0.06]"
            >
              Проверить чек последнего платежа
            </button>
          </form>
        </div>
        <p className="mt-2 text-[11px] text-muted/70">
          «Проверить чек» запрашивает у Точки полные данные последней проведённой операции и пишет их
          в журнал ниже. Если в ответе нет блока чека/ОФД — платёж прошёл, но фискальный чек не
          сформирован (не подключена Точка Касса).
        </p>
      </section>

      {/* --- Webhook delivery log --- */}
      <section className="rounded-xl border border-white/10 p-4">
        <h2 className="mb-3 font-display text-base text-paper">Журнал входящих вебхуков</h2>
        {whLog.length === 0 ? (
          <p className="text-sm text-muted">Пока ничего не получено.</p>
        ) : (
          <div className="space-y-2">
            {whLog.map((row, i) => (
              <details key={i} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <summary className="cursor-pointer text-xs text-paper">
                  <span className="font-mono text-muted">
                    {new Date(row.received_at).toLocaleString('ru-RU')}
                  </span>{' '}
                  · <span className="text-sage">{row.action}</span>
                  {row.parsed_qrc_id ? ` · qrcId ${row.parsed_qrc_id}` : ''}
                  {row.content_type ? ` · ${row.content_type}` : ''}
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-muted">
                  {row.body || '(empty body)'}
                </pre>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
