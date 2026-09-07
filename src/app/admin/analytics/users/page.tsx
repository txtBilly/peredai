import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VERIF: Record<string, string> = {
  verified: 'Проверен',
  pending: 'На проверке',
  failed: 'Отклонён',
  unverified: '—',
};
const INTENT: Record<string, string> = {
  looking: 'Ищет',
  offering: 'Сдаёт',
  both: 'Ищет и сдаёт',
};

type Row = {
  id: string;
  full_name: string | null;
  display_first_name: string | null;
  email: string | null;
  verification_status: string | null;
  intent: string | null;
  created_at: string;
};

export default async function AdminUsersListPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, display_first_name, email, verification_status, intent, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  const rows = (data as Row[] | null) ?? [];
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-6 flex items-baseline gap-3">
        <Link href="/admin/analytics" className="text-sm text-muted hover:text-paper">
          ‹ Аналитика
        </Link>
        <h1 className="font-display text-2xl text-paper">Зарегистрированные пользователи</h1>
        <span className="text-sm text-muted">({rows.length})</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Имя</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Регистрация</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-paper">{r.display_first_name || r.full_name || '—'}</td>
                <td className="px-4 py-3 text-muted">{r.email || '—'}</td>
                <td className="px-4 py-3 text-muted">{VERIF[r.verification_status ?? 'unverified'] ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{r.intent ? INTENT[r.intent] ?? r.intent : '—'}</td>
                <td className="px-4 py-3 text-muted tabular-nums">{fmt(r.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Пока нет пользователей.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted/70">Показаны последние 500 записей, новые сверху.</p>
    </div>
  );
}
