import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { listingPhotoUrl } from '@/lib/listings';
import AdminListingActions from './AdminListingActions';

export const dynamic = 'force-dynamic';

// Staff-only listing viewer — shows a listing at ANY status (active, closed,
// suspended, removed) so reported/hidden listings remain reviewable. Uses the
// service role (the public page refuses non-active listings).
export default async function AdminListingPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: listing } = await admin.from('listings').select('*').eq('id', params.id).maybeSingle();

  if (!listing) {
    return (
      <div>
        <Link href="/admin/listings" className="text-sm text-gold hover:underline">‹ Back to listings</Link>
        <p className="mt-6 text-sm text-red-400">Listing not found.</p>
      </div>
    );
  }

  const [{ data: photos }, { data: reports }, { data: lister }] = await Promise.all([
    admin.from('listing_photos').select('storage_path').eq('listing_id', params.id).order('sort_order'),
    admin
      .from('reports')
      .select('id, reporter_id, reason, detail, status, created_at')
      .eq('listing_id', params.id)
      .order('created_at', { ascending: false }),
    admin.from('profiles').select('full_name, email, is_shadow_banned').eq('id', listing.lister_id).maybeSingle(),
  ]);

  const rows: [string, unknown][] = [
    ['Status', listing.status],
    ['Neighborhood', listing.neighborhood],
    ['Cross streets', listing.cross_streets],
    ['Full address', listing.full_address],
    ['Zip', listing.zip],
    ['Type', listing.type],
    ['Rent', listing.monthly_rent != null ? `$${listing.monthly_rent}/mo` : null],
    ['Min credit score', listing.min_credit_score],
    ['Gratitude', listing.gratitude_amount != null ? `$${listing.gratitude_amount}` : null],
    ['Available from', listing.available_from],
    ['Contact', `${listing.contact_name ?? '—'} · ${listing.contact_phone ?? '—'}`],
    ['Lister', `${lister?.full_name || lister?.email || listing.lister_id.slice(0, 8)}${lister?.is_shadow_banned ? ' · shadow-banned' : ''}`],
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-4">
        <Link href="/admin" className="text-sm text-gold hover:underline">‹ Back to reports</Link>
        <Link href="/admin/listings" className="text-sm text-muted hover:text-paper">Suspended listings</Link>
      </div>
      <h1 className="mb-4 mt-4 font-display text-2xl text-paper">{listing.neighborhood ?? 'Listing'}</h1>

      {photos && photos.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.storage_path}
              src={listingPhotoUrl(p.storage_path)}
              alt=""
              className="h-28 w-28 rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      <dl className="mb-6 grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-paper">{v == null || v === '' ? '—' : String(v)}</dd>
          </div>
        ))}
      </dl>

      {listing.description && (
        <div className="mb-6">
          <p className="mb-1 text-sm text-muted">Description</p>
          <p className="whitespace-pre-wrap text-sm text-paper">{listing.description}</p>
        </div>
      )}

      <div className="mb-8">
        <p className="mb-2 text-sm text-muted">Reports against this listing ({reports?.length ?? 0})</p>
        {reports && reports.length > 0 ? (
          <div className="flex flex-col gap-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-sm">
                <span className="text-xs uppercase tracking-wide text-muted">{r.reason}</span> · {r.status}
                {r.detail && <p className="text-muted">{r.detail}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">None.</p>
        )}
      </div>

      <AdminListingActions listingId={listing.id} status={listing.status} />
    </div>
  );
}
