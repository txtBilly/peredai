import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активно',
  negotiating: 'В диалоге',
  closed: 'Закрыто',
  suspended: 'Скрыто',
  removed: 'Удалено',
};
const TYPE: Record<string, string> = {
  apartment: 'Квартира',
  room: 'Комната',
  studio: 'Студия',
  house: 'Дом',
};

type Row = {
  id: string;
  neighborhood: string | null;
  city: string | null;
  type: string | null;
  monthly_rent: number | null;
  status: string | null;
  created_at: string;
};

export default async function AdminListingsListPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('listings')
    .select('id, neighborhood, city, type, monthly_rent, status, created_at')
    .eq('is_seed', false)
    .order('created_at', { ascending: false })
    .limit(500);
  const rows = (data as Row[] | null) ?? [];
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rub = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('ru-RU')} ₽`);

  return (
    <div>
      <div className="mb-6 flex items-baseline gap-3">
        <Link href="/admin/analytics" className="text-sm text-muted hover:text-paper">
          ‹ Аналитика
        </Link>
        <h1 className="font-display text-2xl text-paper">Новые объявления</h1>
        <span className="text-sm text-muted">({rows.length})</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Район</th>
              <th className="px-4 py-3 font-medium">Город</th>
              <th className="px-4 py-3 font-medium">Тип</th>
              <th className="px-4 py-3 font-medium">Аренда</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Создано</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <Link href={`/admin/listings/${r.id}`} className="text-gold hover:underline">
                    {r.neighborhood || '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{r.city || '—'}</td>
                <td className="px-4 py-3 text-muted">{r.type ? TYPE[r.type] ?? r.type : '—'}</td>
                <td className="px-4 py-3 text-muted tabular-nums">{rub(r.monthly_rent)}</td>
                <td className="px-4 py-3 text-muted">{STATUS[r.status ?? ''] ?? r.status ?? '—'}</td>
                <td className="px-4 py-3 text-muted tabular-nums">{fmt(r.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Пока нет объявлений.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted/70">Показаны последние 500 записей (без засева), новые сверху.</p>
    </div>
  );
}
