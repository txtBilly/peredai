import { createAdminClient } from '@/lib/supabase/server';
import AdminCouponForm from './AdminCouponForm';
import AdminCouponActions from './AdminCouponActions';

export const dynamic = 'force-dynamic';

type Coupon = {
  id: string;
  code: string;
  kind: 'percent' | 'fixed' | 'free';
  value: number;
  bonus_credits: number;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  note: string | null;
  created_at: string;
};

export default async function AdminCouponsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('coupons')
    .select(
      'id, code, kind, value, bonus_credits, active, starts_at, expires_at, max_redemptions, redeemed_count, note, created_at'
    )
    .order('created_at', { ascending: false });
  const coupons = (data as Coupon[] | null) ?? [];

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '—');
  const effect = (c: Coupon) => {
    if (c.kind === 'free') return 'Бесплатно (100%)';
    if (c.kind === 'percent') return `−${c.value}%`;
    return `−${c.value.toLocaleString('ru-RU')} ₽`;
  };
  const isExpired = (c: Coupon) => !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl text-paper">Промокоды</h1>
        <AdminCouponForm />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Код</th>
              <th className="px-4 py-3 font-medium">Скидка</th>
              <th className="px-4 py-3 font-medium text-right">Бонус</th>
              <th className="px-4 py-3 font-medium text-right">Использовано</th>
              <th className="px-4 py-3 font-medium">Действует до</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {coupons.map((c) => {
              const expired = isExpired(c);
              const maxed = c.max_redemptions != null && c.redeemed_count >= c.max_redemptions;
              return (
                <tr key={c.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-paper">{c.code}</span>
                    {c.note && <p className="mt-0.5 text-[11px] text-muted/70">{c.note}</p>}
                  </td>
                  <td className="px-4 py-3 text-paper">{effect(c)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {c.bonus_credits > 0 ? `+${c.bonus_credits}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {c.redeemed_count}
                    {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ''}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">{fmtDate(c.expires_at)}</td>
                  <td className="px-4 py-3">
                    {!c.active ? (
                      <span className="text-muted">Отключён</span>
                    ) : expired ? (
                      <span className="text-amber-300">Истёк</span>
                    ) : maxed ? (
                      <span className="text-amber-300">Исчерпан</span>
                    ) : (
                      <span className="text-sage">Активен</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AdminCouponActions couponId={c.id} active={c.active} redeemed={c.redeemed_count} />
                  </td>
                </tr>
              );
            })}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Промокодов пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted/70">
        «Скидка» — процент, фиксированная сумма в ₽ или 100% (бесплатно). «Бонус» — дополнительные токены сверх
        покупки. Один промокод — одно применение на аккаунт; промокоды не суммируются. Отключённый или истёкший
        промокод не применяется при оплате.
      </p>
    </div>
  );
}
