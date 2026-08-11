import Link from 'next/link';
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
  is_banned: boolean;
  is_suppressed: boolean;
  rating_avg: number | null;
  rating_count: number;
  id_type: string | null;
  id_last4: string | null;
  identity_verified_at: string | null;
  duplicate_review: boolean;
  duplicate_reason: string | null;
  duplicate_matched_id: string | null;
};

type ListingLite = { id: string; neighborhood: string | null; status: string };
type ChatLite = { id: string; status: string; role: 'seeker' | 'lister' };
// One row of the identity_documents audit trail, plus a resolved view link
// (signed URL for self-hosted uploads, Stripe dashboard link for sessions).
type IdDoc = {
  id: string;
  kind: string;
  status: string;
  doc_type: string | null;
  id_last4: string | null;
  vendor_ref: string | null;
  created_at: string;
  viewUrl: string | null;
  viewLabel: string;
};
type Result = {
  id: string;
  email: string;
  profile?: Profile;
  balance: number;
  strikes: number;
  listings: ListingLite[];
  chats: ChatLite[];
  idDocs: IdDoc[];
};

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();
  const admin = createAdminClient();

  let results: Result[] = [];
  if (q) {
    // Search across account email, full (legal) name, visible display name,
    // phone, and — if pasted — exact user id.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = list?.users ?? [];
    const emailById = new Map(users.map((u) => [u.id, u.email ?? '']));
    const ql = q.toLowerCase();

    const emailIds = users.filter((u) => (u.email ?? '').toLowerCase().includes(ql)).map((u) => u.id);

    const safe = q.replace(/[,()]/g, ' ').trim();
    const isUuid = /^[0-9a-f-]{36}$/i.test(q);
    let profileIds: string[] = [];
    if (safe) {
      const filters = [
        `full_name.ilike.*${safe}*`,
        `display_first_name.ilike.*${safe}*`,
        `phone.ilike.*${safe}*`,
        ...(isUuid ? [`id.eq.${q}`] : []),
      ].join(',');
      const { data: pm } = await admin.from('profiles').select('id').or(filters);
      profileIds = ((pm as { id: string }[] | null) ?? []).map((p) => p.id);
    }

    const ids = Array.from(new Set([...emailIds, ...profileIds])).slice(0, 25);
    if (ids.length) {
      const [{ data: profs }, { data: ledger }, { data: strikes }, { data: listingsData }, { data: chatsData }] =
        await Promise.all([
          admin
            .from('profiles')
            .select(
              'id, full_name, verification_status, bg_check_completed_at, bg_check_expires_at, is_shadow_banned, is_banned, is_suppressed, rating_avg, rating_count, id_type, id_last4, identity_verified_at, duplicate_review, duplicate_reason, duplicate_matched_id'
            )
            .in('id', ids),
          admin.from('credit_ledger').select('seeker_id, amount').in('seeker_id', ids),
          admin.from('strikes').select('user_id').in('user_id', ids),
          admin.from('listings').select('id, neighborhood, status, lister_id').in('lister_id', ids),
          admin
            .from('chats')
            .select('id, status, seeker_id, lister_id')
            .or(`seeker_id.in.(${ids.join(',')}),lister_id.in.(${ids.join(',')})`),
        ]);

      // Identity-document audit trail (append-only). For self-hosted uploads we
      // mint a short-lived signed URL; for Stripe sessions we link to the
      // dashboard (the images live at Stripe for compliance).
      const { data: idDocsData } = await admin
        .from('identity_documents')
        .select('id, user_id, kind, status, doc_type, id_last4, storage_path, vendor_ref, created_at')
        .in('user_id', ids)
        .order('created_at', { ascending: false });
      const rawDocs =
        (idDocsData as
          | {
              id: string;
              user_id: string;
              kind: string;
              status: string;
              doc_type: string | null;
              id_last4: string | null;
              storage_path: string | null;
              vendor_ref: string | null;
              created_at: string;
            }[]
          | null) ?? [];
      const docsByUser = new Map<string, IdDoc[]>();
      for (const doc of rawDocs) {
        let viewUrl: string | null = null;
        let viewLabel = '—';
        if (doc.kind === 'upload' && doc.storage_path) {
          const { data: signed } = await admin.storage
            .from('id-documents')
            .createSignedUrl(doc.storage_path, 300);
          viewUrl = signed?.signedUrl ?? null;
          viewLabel = 'View upload';
        } else if (doc.kind === 'stripe' && doc.vendor_ref) {
          viewUrl = `https://dashboard.stripe.com/identity/verification-sessions/${doc.vendor_ref}`;
          viewLabel = 'Open in Stripe';
        }
        const arr = docsByUser.get(doc.user_id) ?? [];
        arr.push({
          id: doc.id,
          kind: doc.kind,
          status: doc.status,
          doc_type: doc.doc_type,
          id_last4: doc.id_last4,
          vendor_ref: doc.vendor_ref,
          created_at: doc.created_at,
          viewUrl,
          viewLabel,
        });
        docsByUser.set(doc.user_id, arr);
      }

      const listingsByUser = new Map<string, ListingLite[]>();
      ((listingsData as (ListingLite & { lister_id: string })[] | null) ?? []).forEach((l) => {
        const arr = listingsByUser.get(l.lister_id) ?? [];
        arr.push({ id: l.id, neighborhood: l.neighborhood, status: l.status });
        listingsByUser.set(l.lister_id, arr);
      });
      const chatsByUser = new Map<string, ChatLite[]>();
      ((chatsData as { id: string; status: string; seeker_id: string; lister_id: string }[] | null) ?? []).forEach(
        (c) => {
          ids.forEach((uid) => {
            if (c.seeker_id === uid || c.lister_id === uid) {
              const arr = chatsByUser.get(uid) ?? [];
              arr.push({ id: c.id, status: c.status, role: c.seeker_id === uid ? 'seeker' : 'lister' });
              chatsByUser.set(uid, arr);
            }
          });
        }
      );
      const pmap = new Map(((profs as Profile[] | null) ?? []).map((p) => [p.id, p]));
      const balance = new Map<string, number>();
      ((ledger as { seeker_id: string; amount: number }[] | null) ?? []).forEach((l) =>
        balance.set(l.seeker_id, (balance.get(l.seeker_id) ?? 0) + l.amount)
      );
      const strikeCount = new Map<string, number>();
      ((strikes as { user_id: string }[] | null) ?? []).forEach((s) =>
        strikeCount.set(s.user_id, (strikeCount.get(s.user_id) ?? 0) + 1)
      );
      results = ids.map((id) => ({
        id,
        email: emailById.get(id) || '—',
        profile: pmap.get(id),
        balance: balance.get(id) ?? 0,
        strikes: strikeCount.get(id) ?? 0,
        listings: listingsByUser.get(id) ?? [],
        chats: chatsByUser.get(id) ?? [],
        idDocs: docsByUser.get(id) ?? [],
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
          placeholder="Search by email, name, or phone…"
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
                {p?.is_banned && <span className="font-medium text-red-400">⛔ fully banned</span>}
                {p?.is_shadow_banned && <span className="text-red-300">shadow-banned</span>}
                {p?.is_suppressed && <span className="text-amber-300">suppressed</span>}
                {p?.duplicate_review && (
                  <span className="text-amber-300">
                    ⚠ duplicate review{p.duplicate_reason ? ` (${p.duplicate_reason.replace(/_/g, ' ')})` : ''}
                  </span>
                )}
                <span>{r.balance} credit(s)</span>
                <span>{p?.rating_count ? `${p.rating_avg}★ (${p.rating_count})` : 'no ratings'}</span>
              </div>

              <div className="mt-2 text-xs text-muted">
                <span className="text-paper">Listings ({r.listings.length}):</span>{' '}
                {r.listings.length === 0
                  ? 'none'
                  : r.listings.map((l) => (
                      <Link key={l.id} href={`/admin/listings/${l.id}`} className="mr-2 text-gold hover:underline">
                        {l.neighborhood ?? '—'} ({l.status})
                      </Link>
                    ))}
              </div>
              <div className="mt-1 text-xs text-muted">
                <span className="text-paper">Conversations ({r.chats.length}):</span>{' '}
                {r.chats.length === 0
                  ? 'none'
                  : r.chats.map((c) => (
                      <Link key={c.id} href={`/admin/chats/${c.id}`} className="mr-2 text-gold hover:underline">
                        as {c.role} ({c.status})
                      </Link>
                    ))}
              </div>

              {/* Identity verification (customer-service audit view). */}
              <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-paper">ID verification:</span>
                  {p?.identity_verified_at ? (
                    <span className="text-sage">
                      ✓ {p.id_type ? p.id_type.replace(/_/g, ' ') : 'document'}
                      {p.id_last4 ? ` ····${p.id_last4}` : ''} ·{' '}
                      {new Date(p.identity_verified_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>no verified ID on file</span>
                  )}
                </div>
                {r.idDocs.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {r.idDocs.map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center gap-x-2">
                        <span className="text-paper/80">{new Date(doc.created_at).toLocaleString()}</span>
                        <span>· {doc.kind}</span>
                        <span>· {doc.status}</span>
                        {doc.doc_type && <span>· {doc.doc_type.replace(/_/g, ' ')}</span>}
                        {doc.id_last4 && <span>· ····{doc.id_last4}</span>}
                        {doc.viewUrl && (
                          <a
                            href={doc.viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gold hover:underline"
                          >
                            {doc.viewLabel}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <AdminUserActions
                userId={r.id}
                shadowBanned={!!p?.is_shadow_banned}
                duplicateReview={!!p?.duplicate_review}
                fullBanned={!!p?.is_banned}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
