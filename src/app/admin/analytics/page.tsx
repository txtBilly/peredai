import { createAdminClient } from '@/lib/supabase/server';
import { TOKEN_PRICE_RUB } from '@/lib/yookassa';

export const dynamic = 'force-dynamic';

// Staff analytics — core KPI tiles (all-time, last 30 days, last 7 days).
// Gated by the /admin layout's is_staff check. Reads via the service-role client.
//
// Notes on the numbers:
//  - "New listings" excludes cold-start seed rows (is_seed = true).
//  - Payments / Tokens / Revenue count REAL purchases only: mock-mode and
//    100%-off (free-coupon) grants are excluded by their ledger ref prefix.
//  - Revenue is an estimate — the ledger stores the token count, not the ₽ paid,
//    so revenue ≈ paid tokens × TOKEN_PRICE_RUB − coupon discounts. For an exact
//    figure we'd add an amount_rub column written by the YooKassa webhook.
export default async function AdminAnalyticsPage() {
  const admin = createAdminClient();

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const since7 = new Date(now - 7 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();

  // Count helper (head:true → no rows transferred, just the count).
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

  const tiles: { label: string; total: string; d30: string; d7: string; note?: string }[] = [
    { label: 'Registered users', total: nf(usersTotal), d30: nf(users30), d7: nf(users7) },
    { label: 'New listings', total: nf(listingsTotal), d30: nf(listings30), d7: nf(listings7), note: 'excl. seed' },
    { label: 'Payments', total: nf(paymentsTotal), d30: nf(payments30), d7: nf(payments7), note: 'real, excl. mock/free' },
    { label: 'Tokens purchased', total: nf(tokensTotal), d30: nf(tokens30), d7: nf(tokens7) },
    { label: 'Revenue (est.)', total: rub(revenueTotal), d30: rub(revenue30), d7: rub(revenue7), note: '≈ tokens × price − discounts' },
  ];

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-paper">Analytics</h1>
        <span className="text-xs text-muted">Updated just now · all-time / 30d / 7d</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-muted">{t.label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-paper">{t.total}</p>
            <div className="mt-3 flex gap-5 text-xs text-muted">
              <span>
                <span className="font-semibold text-paper">{t.d30}</span> · 30d
              </span>
              <span>
                <span className="font-semibold text-paper">{t.d7}</span> · 7d
              </span>
            </div>
            {t.note && <p className="mt-2 text-[11px] text-muted/70">{t.note}</p>}
          </div>
        ))}
      </div>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted/70">
        Revenue is an estimate: the credit ledger stores the token count, not the ₽ actually paid, so it is computed as
        paid tokens × {TOKEN_PRICE_RUB} ₽ minus coupon discounts. Mock-mode and 100%-off grants are excluded from
        Payments, Tokens and Revenue. For an exact revenue figure, add an <code>amount_rub</code> column to the ledger,
        written by the YooKassa webhook.
      </p>
    </div>
  );
}
