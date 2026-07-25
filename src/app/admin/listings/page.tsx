import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ListingRow = {
  id: string;
  neighborhood: string | null;
  type: string | null;
  monthly_rent: number | null;
};

// Suspended listings only — the one thing the Reports queue doesn't surface.
// Reported (but not yet actioned) listings live in Reports; this is where a
// hidden listing can be reviewed and restored.
export default async function AdminSuspendedListingsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('listings')
    .select('id, neighborhood, type, monthly_rent')
    .eq('status', 'suspended')
    .order('updated_at', { ascending: false });
  const rows = (data as ListingRow[] | null) ?? [];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-paper">Suspended listings</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No suspended listings.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((l) => (
            <Link
              key={l.id}
              href={`/admin/listings/${l.id}`}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm transition hover:border-white/25"
            >
              <span className="text-paper">
                {l.neighborhood ?? '—'}{' '}
                <span className="text-muted">
                  · {l.type ?? ''} {l.monthly_rent != null ? `· $${l.monthly_rent}/mo` : ''}
                </span>
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
                suspended
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
