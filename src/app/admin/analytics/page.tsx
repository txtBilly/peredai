import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { TOKEN_PRICE_RUB } from '@/lib/yookassa';

export const dynamic = 'force-dynamic';

// Аналитика для персонала — ключевые показатели (за всё время / 30 дней / 7 дней)
// плюс таблица транзакций (платежей) по датам. Доступ ограничен проверкой
// is_staff в layout. Чтение через сервис-клиент.
//
// Примечания к цифрам:
//  - «Новые объявления» не учитывают засев (is_seed = true).
//  - «Платежи» / «Куплено токенов» / «Выручка» учитывают только реальные покупки:
//    тестовый режим и купоны «100% скидка» исключены по префиксу ссылки платежа.
//  - Выручка — оценка: в реестре хранится число токенов, а не уплаченная сумма,
//    поэтому выручка ≈ оплаченные токены × TOKEN_PRICE_RUB − скидки по купонам.
export default async function AdminAnalyticsPage() {
  const admin = createAdminClient();

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const since7 = new Date(now - 7 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();

  async function countRows(
    table: string,
    build: (q: ReturnType<ReturnType<typeof admin.from>['select']>) => ReturnType<ReturnType<typeof admin.from>['select']>
  ): Promise<number> {
    const { count } = await build(admin.from(table).select('*', { count: 'exact', head: true }));
    return count ?? 0;
  }

  const [
    usersTotal, users30, users7,
    listingsTotal, listings30, listings7,
    purchasesRes, redemptionsRes,
  ] = await Promise.all([
    countRows('profiles', (q) => q.is('deleted_at', null)),
    countRows('profiles', (q) => q.is('deleted_at', null).gte('created_at', since30)),
    countRows('profiles', (q) => q.is('deleted_at', null).gte('created_at', since7)),
    countRows('listings', (q) => q.eq('is_seed', false)),
    countRows('listings', (q) => q.eq('is_seed', false).gte('created_at', since30)),
    countRows('listings', (q) => q.eq('is_seed', false).gte('created_at', since7)),
    admin
      .from('credit_ledger')
      .select('amount, created_at, seeker_id, stripe_payment_intent, note')
      .eq('event', 'purchase')
      .order('created_at', { ascending: false }),
    admin.from('coupon_redemptions').select('amount_discounted, created_at, payment_ref'),
  ]);

  type Purchase = {
    amount: number;
    created_at: string;
    seeker_id: string;
    stripe_payment_intent: string | null;
    note: string | null;
  };
  const allPurchases = (purchasesRes.data as Purchase[] | null) ?? [];
  const kind = (ref: string | null): 'real' | 'mock' | 'free' =>
    ref?.startsWith('mocksbp_') ? 'mock' : ref?.startsWith('freecoupon_') ? 'free' : 'real';
  const realPurchases = allPurchases.filter((p) => kind(p.stripe_payment_intent) === 'real');

  const inWindow = (iso: string, since: string) => iso >= since;
  const paymentsTotal = realPurchases.length;
  const payments30 = realPurchases.filter((p) => inWindow(p.created_at, since30)).length;
  const payments7 = realPurchases.filter((p) => inWindow(p.created_at, since7)).length;

  const sum = (rows: Purchase[]) => rows.reduce((s, p) => s + (p.amount ?? 0), 0);
  const tokensTotal = sum(realPurchases);
  const tokens30 = sum(realPurchases.filter((p) => inWindow(p.created_at, since30)));
  const tokens7 = sum(realPurchases.filter((p) => inWindow(p.created_at, since7)));

  type Redemption = { amount_discounted: number | null; created_at: string; payment_ref: string | null };
  const redemptions = (redemptionsRes.data as Redemption[] | null) ?? [];
  const discByRef = new Map<string, number>();
  for (const r of redemptions) {
    if (r.payment_ref) discByRef.set(r.payment_ref, (discByRef.get(r.payment_ref) ?? 0) + (r.amount_discounted ?? 0));
  }
  const discSum = (rows: Redemption[]) => rows.reduce((s, r) => s + (r.amount_discounted ?? 0), 0);
  const revenueTotal = tokensTotal * TOKEN_PRICE_RUB - discSum(redemptions);
  const revenue30 =
    tokens30 * TOKEN_PRICE_RUB - discSum(redemptions.filter((r) => inWindow(r.created_at, since30)));
  const revenue7 =
    tokens7 * TOKEN_PRICE_RUB - discSum(redemptions.filter((r) => inWindow(r.created_at, since7)));

  const nf = (n: number) => n.toLocaleString('ru-RU');
  const rub = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString('ru-RU')} ₽`;

  const tiles: { label: string; total: string; d30: string; d7: string; note?: string; href?: string }[] = [
    { label: 'Зарегистрированные пользователи', total: nf(usersTotal), d30: nf(users30), d7: nf(users7), href: '/admin/analytics/users' },
    { label: 'Новые объявления', total: nf(listingsTotal), d30: nf(listings30), d7: nf(listings7), note: 'без засева', href: '/admin/analytics/listings' },
    { label: 'Платежи', total: nf(paymentsTotal), d30: nf(payments30), d7: nf(payments7), note: 'реальные, без тестовых' },
    { label: 'Куплено токенов', total: nf(tokensTotal), d30: nf(tokens30), d7: nf(tokens7) },
    { label: 'Выручка (оценка)', total: rub(revenueTotal), d30: rub(revenue30), d7: rub(revenue7), note: '≈ токены × цена − скидки' },
  ];

  // --- Transactions table (most recent 100 purchases, all kinds) ---
  const recent = allPurchases.slice(0, 100);
  const seekerIds = Array.from(new Set(recent.map((p) => p.seeker_id)));
  const { data: profData } = seekerIds.length
    ? await admin.from('profiles').select('id, email, display_first_name, full_name').in('id', seekerIds)
    : { data: [] as { id: string; email: string | null; display_first_name: string | null; full_name: string | null }[] };
  const profMap = new Map((profData ?? []).map((p) => [p.id, p]));

  const KIND_LABEL: Record<'real' | 'mock' | 'free', string> = {
    real: 'Оплата',
    mock: 'Тест',
    free: 'Бесплатно',
  };
  const fmtDT = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const txRows = recent.map((p) => {
    const k = kind(p.stripe_payment_intent);
    const prof = profMap.get(p.seeker_id);
    const who = prof?.email || prof?.display_first_name || prof?.full_name || p.seeker_id.slice(0, 8);
    const disc = p.stripe_payment_intent ? discByRef.get(p.stripe_payment_intent) ?? 0 : 0;
    const amountRub = k === 'real' ? Math.max(0, p.amount * TOKEN_PRICE_RUB - disc) : 0;
    return { at: p.created_at, who, tokens: p.amount, k, disc, amountRub };
  });

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-paper">Аналитика</h1>
        <span className="text-xs text-muted">За всё время · 30 дн. · 7 дн.</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const inner = (
            <>
              <p className="text-sm text-muted">
                {t.label}
                {t.href && <span className="ml-1 text-gold" aria-hidden="true">→</span>}
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-paper">{t.total}</p>
              <div className="mt-3 flex gap-5 text-xs text-muted">
                <span>
                  <span className="font-semibold text-paper">{t.d30}</span> · 30 дн.
                </span>
                <span>
                  <span className="font-semibold text-paper">{t.d7}</span> · 7 дн.
                </span>
              </div>
              {t.note && <p className="mt-2 text-[11px] text-muted/70">{t.note}</p>}
            </>
          );
          const cls = 'block rounded-xl border border-white/10 bg-white/[0.03] p-5';
          return t.href ? (
            <Link key={t.label} href={t.href} className={`${cls} transition hover:border-white/25 hover:bg-white/[0.06]`}>
              {inner}
            </Link>
          ) : (
            <div key={t.label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Transactions ledger */}
      <div className="mt-10 mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-xl text-paper">Транзакции (платежи)</h2>
        <span className="text-sm text-muted">последние {txRows.length}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Пользователь</th>
              <th className="px-4 py-3 font-medium text-right">Токенов</th>
              <th className="px-4 py-3 font-medium text-right">Скидка</th>
              <th className="px-4 py-3 font-medium text-right">Сумма ≈</th>
              <th className="px-4 py-3 font-medium">Тип</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {txRows.map((t, i) => (
              <tr key={i} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-muted tabular-nums whitespace-nowrap">{fmtDT(t.at)}</td>
                <td className="px-4 py-3 text-paper">{t.who}</td>
                <td className="px-4 py-3 text-right tabular-nums text-paper">{t.tokens}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">{t.disc > 0 ? rub(t.disc) : '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-paper">{t.k === 'real' ? rub(t.amountRub) : '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      t.k === 'real'
                        ? 'text-sage'
                        : t.k === 'free'
                          ? 'text-gold'
                          : 'text-muted'
                    }
                  >
                    {KIND_LABEL[t.k]}
                  </span>
                </td>
              </tr>
            ))}
            {txRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Пока нет транзакций.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted/70">
        Выручка — оценка: в реестре хранится число токенов, а не уплаченная сумма, поэтому она считается как
        оплаченные токены × {TOKEN_PRICE_RUB} ₽ минус скидки по купонам. Тестовые платежи и купоны «100% скидка» в
        показатели «Платежи», «Куплено токенов» и «Выручка» не входят (в таблице они помечены как «Тест» и
        «Бесплатно»). Для точной выручки нужно добавить в реестр колонку <code>amount_rub</code>, заполняемую вебхуком
        YooKassa.
      </p>
    </div>
  );
}
