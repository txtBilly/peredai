import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import AdminReportActions from './AdminReportActions';

export const dynamic = 'force-dynamic';

type Report = {
  id: string;
  reporter_id: string;
  reported_user: string | null;
  listing_id: string | null;
  chat_id: string | null;
  reason: string;
  detail: string | null;
  created_at: string;
};

type ProfileLite = { id: string; full_name: string | null; email: string | null; is_shadow_banned: boolean };

export default async function AdminReportsPage() {
  const admin = createAdminClient();
  const { data: reportsData } = await admin
    .from('reports')
    .select('id, reporter_id, reported_user, listing_id, chat_id, reason, detail, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  const reports = (reportsData as Report[] | null) ?? [];

  const userIds = Array.from(
    new Set(reports.flatMap((r) => [r.reporter_id, r.reported_user]).filter(Boolean) as string[])
  );
  const { data: profilesData } = userIds.length
    ? await admin.from('profiles').select('id, full_name, email, is_shadow_banned').in('id', userIds)
    : { data: [] as ProfileLite[] };
  const profiles = new Map((profilesData as ProfileLite[] | null ?? []).map((p) => [p.id, p]));

  const reportedIds = Array.from(new Set(reports.map((r) => r.reported_user).filter(Boolean) as string[]));
  const { data: strikesData } = reportedIds.length
    ? await admin.from('strikes').select('user_id').in('user_id', reportedIds)
    : { data: [] as { user_id: string }[] };
  const strikeCount = new Map<string, number>();
  ((strikesData as { user_id: string }[] | null) ?? []).forEach((s) =>
    strikeCount.set(s.user_id, (strikeCount.get(s.user_id) ?? 0) + 1)
  );

  const name = (id: string | null) =>
    id ? profiles.get(id)?.full_name || profiles.get(id)?.email || id.slice(0, 8) : '—';

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-paper">Report queue</h1>
      {reports.length === 0 ? (
        <p className="text-sm text-muted">No open reports.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
                  {r.reason}
                </span>
                <span className="text-paper">{name(r.reporter_id)}</span>
                <span className="text-muted">reported</span>
                <span className="text-paper">{name(r.reported_user)}</span>
                {r.reported_user && (
                  <span className="text-xs text-amber-300">
                    {strikeCount.get(r.reported_user) ?? 0} prior strike(s)
                    {profiles.get(r.reported_user)?.is_shadow_banned ? ' · shadow-banned' : ''}
                  </span>
                )}
              </div>
              {r.detail && <p className="mb-3 text-sm text-muted">{r.detail}</p>}
              <div className="mb-3 text-xs text-muted">{new Date(r.created_at).toLocaleString()}</div>
              <div className="flex flex-wrap items-center gap-4">
                <AdminReportActions reportId={r.id} />
                <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
                  {r.chat_id && (
                    <Link
                      href={`/admin/chats/${r.chat_id}`}
                      className="rounded-full border border-gold/50 px-3 py-1.5 font-medium text-gold ring-1 ring-inset ring-gold/20 transition hover:bg-gold/10"
                    >
                      View chat →
                    </Link>
                  )}
                  {r.listing_id && (
                    <Link
                      href={`/admin/listings/${r.listing_id}`}
                      className="rounded-full border border-white/20 px-3 py-1.5 font-medium text-paper transition hover:border-white/40"
                    >
                      View listing →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
