import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { TOKEN_PRICE_RUB } from '@/lib/yookassa';

export const dynamic = 'force-dynamic';

// Аналитика для персонала — ключевые показатели (за всё время / 30 дней / 7 дней).
// Доступ ограничен проверкой is_staff в layout. Чтение через сервис-клиент.
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
    admin.from('credit_ledger').select('amount, created_at, stripe_payment_intent').eq('event', 'purchase'),
    admin.from('coupon_redemptions').select('amount_discounted, created_at'),
  ]);

  type Purchase = { amount: number; created_at: string; stripe_payment_intent: string | null };
  const isTest = (ref: string | null) =>
    !!ref && (ref.startsWith('mocksbp_') || ref.startsWith('freecoupon_'));
  const purchases = ((purchasesRes.data as Purchase[] | null) ?? []).filter(
    (p) => !isTest(p.stripe_payment_intent)
  );

  const inWindow = (iso: string, since: string) => iso >= since;
  const paymentsTotal = purchases.length;
  const payments30 = purchases.filter((p) => inWindow(p.created_at, since30)).length;
  const payments7 = purchases.filter((p) => inWindow(p.created_at, since7)).length;

  const sum = (rows: Purchase[]) => rows.reduce((s, p) => s + (p.amount ?? 0), 0);
  const tokensTotal = sum(purchases);
  const tokens30 = sum(purchases.filter((p) => inWindow(p.created_at, since30)));
  const tokens7 = sum(purchases.filter((p) => inWindow(p.created_at, since7)));

  type Redemption = { amount_discounted: number | null; created_at: string };
  const redemptions = (redemptionsRes.data as Redemption[] | null) ?? [];
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

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted/70">
        Выручка — оценка: в реестре хранится число токенов, а не уплаченная сумма, поэтому она считается как
        оплаченные токены × {TOKEN_PRICE_RUB} ₽ минус скидки по купонам. Тестовые платежи и купоны «100% скидка» в
        показатели «Платежи», «Куплено токенов» и «Выручка» не входят. Для точной выручки нужно добавить в реестр
        колонку <code>amount_rub</code>, заполняемую вебхуком YooKassa.
      </p>
    </div>
  );
}
