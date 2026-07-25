import { createAdminClient } from '@/lib/supabase/server';
import AdminUserActions from './AdminUserActions';

export const dynamic = 'force-dynamic';

type Profile = {
  id: string;
  full_name: string | null;
  verification_status: string | null;
  bg_check_completed_at: string | null;
  bg_check_expires_at: string | null;
  is_shadow_banned: boolean;
  is_suppressed: boolean;
  rating_avg: number | null;
  rating_count: number;
};

type Result = { id: string; email: string; profile?: Profile; balance: number; strikes: number };

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();
  const admin = createAdminClient();

  let results: Result[] = [];
  if (q) {
    // Search auth users by email (the reliable lookup key), then join standing.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const ql = q.toLowerCase();
    const matched = (list?.users ?? []).filter((u) => (u.email ?? '').toLowerCase().includes(ql)).slice(0, 25);
    const ids = matched.map((u) => u.id);

    if (ids.length) {
      const [{ data: profs }, { data: ledger }, { data: strikes }] = await Promise.all([
        admin
          .from('profiles')
          .select(
            'id, full_name, verification_status, bg_check_completed_at, bg_check_expires_at, is_shadow_banned, is_suppressed, rating_avg, rating_count'
          )
          .in('id', ids),
        admin.from('credit_ledger').select('seeker_id, amount').in('seeker_id', ids),
        admin.from('strikes').select('user_id').in('user_id', ids),
      ]);
      const pmap = new Map(((profs as Profile[] | null) ?? []).map((p) => [p.id, p]));
      const balance = new Map<string, number>();
      ((ledger as { seeker_id: string; amount: number }[] | null) ?? []).forEach((l) =>
        balance.set(l.seeker_id, (balance.get(l.seeker_id) ?? 0) + l.amount)
      );
      const strikeCount = new Map<string, number>();
      ((strikes as { user_id: string }[] | null) ?? []).forEach((s) =>
        strikeCount.set(s.user_id, (strikeCount.get(s.user_id) ?? 0) + 1)
      );
      results = matched.map((u) => ({
        id: u.id,
        email: u.email ?? '—',
        profile: pmap.get(u.id),
        balance: balance.get(u.id) ?? 0,
        strikes: strikeCount.get(u.id) ?? 0,
      }));
    }
  }

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl text-paper">Users</h1>

      <form method="GET" action="/admin/users" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by email…"
          className="w-full max-w-md rounded-lg border border-white/15 bg-ink/40 px-3 py-2.5 text-paper placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-gold"
        />
        <button className="rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-110">
          Search
        </button>
      </form>

      {q && results.length === 0 && <p className="text-sm text-muted">No members match “{q}”.</p>}

      <div className="flex flex-col gap-3">
        {results.map((r) => {
          const p = r.profile;
          const verified =
            p?.verification_status === 'verified' ||
            (!!p?.bg_check_completed_at && (!p.bg_check_expires_at || new Date(p.bg_check_expires_at) > new Date()));
          return (
            <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-paper">{p?.full_name || r.email}</span>
                <span className="text-sm text-muted">{r.email}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                <span>{verified ? '✓ verified' : 'unverified'}</span>
                <span>{r.strikes} strike(s)</span>
                {p?.is_shadow_banned && <span className="text-red-300">shadow-banned</span>}
                {p?.is_suppressed && <span className="text-amber-300">suppressed</span>}
                <span>{r.balance} credit(s)</span>
                <span>{p?.rating_count ? `${p.rating_avg}★ (${p.rating_count})` : 'no ratings'}</span>
              </div>
              <AdminUserActions userId={r.id} shadowBanned={!!p?.is_shadow_banned} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
