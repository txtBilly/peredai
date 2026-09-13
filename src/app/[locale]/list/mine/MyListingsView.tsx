'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { listingPhotoUrl, listingTypeLabel } from '@/lib/listings';

type ListingRow = {
  id: string;
  status: string;
  type: string | null;
  neighborhood: string | null;
  cross_streets: string | null;
  monthly_rent: number | null;
  published_at: string | null;
};

export default function MyListingsView({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const l = d.listing;
  const b = d.browse;
  const m = d.myListings;
  const router = useRouter();

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [activeListing, setActiveListing] = useState<ListingRow | null>(null);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ListingRow[]>([]);
  const [closedListings, setClosedListings] = useState<ListingRow[]>([]);
  const [yearlyCount, setYearlyCount] = useState(0);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [unpublishError, setUnpublishError] = useState('');

  useEffect(() => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      setError(m.errorGeneric);
      setPhase('error');
    }, 12000);

    function finish() {
      if (settled) return false;
      settled = true;
      clearTimeout(timeoutId);
      return true;
    }

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (settled) return;

      if (!user) {
        if (!finish()) return;
        router.replace(`/${locale}/signin`);
        return;
      }

      const { data: rows, error: rowsError } = await supabase
        .from('listings')
        .select('id, status, type, neighborhood, cross_streets, monthly_rent, published_at')
        .eq('lister_id', user.id)
        .order('updated_at', { ascending: false });
      if (settled) return;

      if (rowsError || !rows) {
        if (!finish()) return;
        setError(m.errorGeneric);
        setPhase('error');
        return;
      }

      const active = rows.find((r) => r.status === 'active' || r.status === 'negotiating') ?? null;
      const draftRows = rows.filter((r) => r.status === 'draft');
      const closedRows = rows.filter((r) => r.status === 'closed');

      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const published = rows.filter((r) => r.published_at && new Date(r.published_at) > oneYearAgo).length;

      let photoUrl: string | null = null;
      let chatId: string | null = null;
      if (active) {
        const { data: photo } = await supabase
          .from('listing_photos')
          .select('storage_path')
          .eq('listing_id', active.id)
          .order('sort_order', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (settled) return;
        if (photo) photoUrl = listingPhotoUrl(photo.storage_path);

        const { data: chat } = await supabase
          .from('chats')
          .select('id')
          .eq('listing_id', active.id)
          .eq('status', 'active')
          .maybeSingle();
        if (settled) return;
        chatId = chat?.id ?? null;
      }

      if (!finish()) return;
      setActiveListing(active);
      setActivePhotoUrl(photoUrl);
      setActiveChatId(chatId);
      setDrafts(draftRows);
      setClosedListings(closedRows);
      setYearlyCount(published);
      setPhase('ready');
    }

    load().catch(() => {
      if (!finish()) return;
      setError(m.errorGeneric);
      setPhase('error');
    });

    return () => {
      settled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  async function handleUnpublish() {
    if (!activeListing) return;
    setUnpublishing(true);
    setUnpublishError('');
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/${locale}/signin`);
        return;
      }
      // Only an ACTIVE listing can be unpublished. If a seeker connected in the
      // meantime, the listing is 'negotiating' (chat open) and this status filter
      // matches no rows — we surface the chat-open message. The yearly slot is
      // NOT returned: the limit counts published_at, which we leave intact.
      const { data, error: upErr } = await supabase
        .from('listings')
        .update({ status: 'closed' })
        .eq('id', activeListing.id)
        .eq('lister_id', user.id)
        .eq('status', 'active')
        .select('id');
      if (upErr) {
        setUnpublishError(m.errorGeneric);
        return;
      }
      if (!data || data.length === 0) {
        setUnpublishError(m.unpublishChatOpen);
        return;
      }
      setClosedListings((prev) => [{ ...activeListing, status: 'closed' }, ...prev]);
      setActiveListing(null);
      setActivePhotoUrl(null);
      setActiveChatId(null);
      setShowConfirm(false);
    } catch {
      setUnpublishError(m.errorGeneric);
    } finally {
      setUnpublishing(false);
    }
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 text-center">
        <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
        <p className="text-sm text-muted">{m.loading}</p>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        <p className="mb-4 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
        <p role="alert" className="text-sm text-red-600">
          {error || m.errorGeneric}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl text-ink">{m.title}</h1>
        <p className="text-sm text-muted">{m.yearlyCounter.replace('{count}', String(yearlyCount))}</p>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl text-ink">{m.currentSectionTitle}</h2>
        {activeListing ? (
          <div className="flex gap-4 rounded-2xl border border-black/10 bg-white p-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-black/[0.03]">
              {activePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activePhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink">{activeListing.neighborhood}</p>
                <span className="rounded-full bg-cobalt/20 px-2 py-0.5 text-xs text-cobalt">
                  {activeListing.status === 'negotiating' ? b.statusNegotiating : m.statusActive}
                </span>
              </div>
              <p className="text-sm text-muted">{activeListing.cross_streets}</p>
              <p className="text-sm text-muted">
                {activeListing.monthly_rent != null
                  ? `${activeListing.monthly_rent.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} ${m.rentPerMonth}`
                  : ''}
                {activeListing.type ? ` · ${listingTypeLabel(activeListing.type, l)}` : ''}
              </p>
              <div className="mt-1 flex items-center gap-4">
                {/* Only surface a chat link once a seeker has actually connected. */}
                {activeChatId && (
                  <Link
                    href={`/${locale}/chats/${activeChatId}`}
                    className="self-start text-sm text-cobalt hover:underline"
                  >
                    {m.chatCta}
                  </Link>
                )}
                {activeListing.status === 'active' && (
                  <Link
                    href={`/${locale}/list?id=${activeListing.id}`}
                    className="self-start text-sm text-cobalt hover:underline"
                  >
                    {m.editCta}
                  </Link>
                )}
                {activeListing.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => {
                      setUnpublishError('');
                      setShowConfirm(true);
                    }}
                    className="self-start text-sm text-red-600 hover:underline"
                  >
                    {m.unpublishCta}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
            <p className="mb-3 text-sm text-muted">{m.noActiveListing}</p>
            <Link
              href={`/${locale}/list`}
              className="inline-block rounded-lg bg-gradient-cobalt px-5 py-2.5 font-medium text-white transition hover:brightness-110"
            >
              {m.createCta}
            </Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl text-ink">{m.draftsSectionTitle}</h2>
        {drafts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4"
              >
                <div>
                  <p className="font-medium text-ink">{draft.neighborhood || m.draftUntitled}</p>
                  <p className="text-sm text-muted">
                    {draft.cross_streets}
                    {draft.type ? ` · ${listingTypeLabel(draft.type, l)}` : ''}
                  </p>
                </div>
                <Link
                  href={`/${locale}/list?id=${draft.id}`}
                  className="shrink-0 rounded-lg border border-black/15 px-4 py-2 text-sm text-ink hover:border-black/30"
                >
                  {m.editCta}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{m.noDrafts}</p>
        )}
      </section>

      {closedListings.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl text-ink">{m.closedSectionTitle}</h2>
          <div className="flex flex-col gap-3">
            {closedListings.map((cl) => (
              <div
                key={cl.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4 opacity-80"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink">{cl.neighborhood || m.draftUntitled}</p>
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs text-ink/60">
                      {m.statusClosed}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {cl.cross_streets}
                    {cl.type ? ` · ${listingTypeLabel(cl.type, l)}` : ''}
                  </p>
                  {cl.monthly_rent != null && (
                    <p className="text-sm text-muted">
                      {cl.monthly_rent.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} {m.rentPerMonth}
                    </p>
                  )}
                </div>
                <Link
                  href={`/${locale}/list?id=${cl.id}`}
                  className="shrink-0 rounded-lg border border-black/15 px-4 py-2 text-sm text-ink hover:border-black/30"
                >
                  {m.republishCta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="mb-2 font-display text-lg text-ink">{m.unpublishConfirmTitle}</h3>
            <p className="mb-5 text-sm text-muted">{m.unpublishWarning}</p>
            {unpublishError && (
              <p role="alert" className="mb-3 text-sm text-red-600">
                {unpublishError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setUnpublishError('');
                }}
                disabled={unpublishing}
                className="rounded-lg border border-black/15 px-4 py-2 text-sm text-ink hover:border-black/30 disabled:opacity-60"
              >
                {m.cancelCta}
              </button>
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={unpublishing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {unpublishing ? m.unpublishing : m.unpublishConfirmCta}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
