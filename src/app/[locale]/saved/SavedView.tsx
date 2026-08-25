'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDictionary, intlLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { listingPhotoUrl, listingTypeLabels, type ListingTypeValue } from '@/lib/listings';
import { formatRubles } from '@/lib/format';
import { ListingCard, type ListingCardData } from '@/components/ListingCard';

type ListingRow = {
  id: string;
  lister_id: string;
  neighborhood: string | null;
  cross_streets: string | null;
  type: string | null;
  monthly_rent: number | null;
  sqft: number | null;
  available_from: string | null;
  laundry: boolean | null;
  pets_ok: boolean | null;
  elevator: boolean | null;
  walk_up: boolean | null;
  doorman: boolean | null;
  outdoor: boolean | null;
  no_fee: boolean | null;
  allow_non_rf: boolean | null;
  allow_children: boolean | null;
  gratitude_amount: number | null;
  status: string;
};

export default function SavedView({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const b = d.browse;
  const l = d.listing;
  const s = d.saved;
  const router = useRouter();
  const typeLabels = listingTypeLabels(l);

  const [userId, setUserId] = useState<string | null>(null);
  const [cards, setCards] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.push(`/${locale}/signin?next=saved`);
        return;
      }
      setUserId(user.id);

      // Favourites, newest first.
      const { data: favs } = await supabase
        .from('favourites')
        .select('listing_id, created_at')
        .eq('seeker_id', user.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;

      const ids = (favs ?? []).map((f) => f.listing_id);
      if (ids.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }

      const { data: rows, error: qErr } = await supabase
        .from('listings')
        .select(
          'id, lister_id, neighborhood, cross_streets, type, monthly_rent, sqft, available_from, laundry, pets_ok, elevator, walk_up, doorman, outdoor, no_fee, allow_non_rf, allow_children, gratitude_amount, status'
        )
        .in('id', ids);
      if (cancelled) return;
      if (qErr || !rows) {
        setError(b.errorGeneric);
        setLoading(false);
        return;
      }

      const listerIds = Array.from(new Set(rows.map((r) => r.lister_id)));
      const [photosResult, listersResult] = await Promise.all([
        supabase
          .from('listing_photos')
          .select('listing_id, storage_path, slot, sort_order')
          .in('listing_id', ids)
          .order('sort_order', { ascending: true }),
        listerIds.length
          ? supabase.from('public_profile_summary').select('id, is_verified').in('id', listerIds)
          : Promise.resolve({ data: [] as { id: string; is_verified: boolean }[] }),
      ]);
      if (cancelled) return;

      const photoByListing = new Map<string, string>();
      (photosResult.data ?? []).forEach((p) => {
        const current = photoByListing.get(p.listing_id);
        if (!current || p.slot === 'bedroom') photoByListing.set(p.listing_id, p.storage_path);
      });
      const verifiedListers = new Set((listersResult.data ?? []).filter((p) => p.is_verified).map((p) => p.id));
      const dateLocale = intlLocale(locale);

      // Preserve the favourites order (newest first).
      const orderIndex = new Map(ids.map((id, i) => [id, i]));
      const ordered = [...(rows as ListingRow[])].sort(
        (a, c) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(c.id) ?? 0)
      );

      const nextCards: ListingCardData[] = ordered.map((row) => {
        const photoPath = photoByListing.get(row.id);
        const amenityLabels: string[] = [];
        if (row.laundry) amenityLabels.push(l.amenityLaundry);
        if (row.pets_ok) amenityLabels.push(l.amenityPetsOk);
        if (row.elevator) amenityLabels.push(l.amenityElevator);
        if (row.walk_up) amenityLabels.push(l.amenityWalkUp);
        if (row.doorman) amenityLabels.push(l.amenityDoorman);
        if (row.outdoor) amenityLabels.push(l.amenityOutdoor);
        if (row.allow_non_rf) amenityLabels.push(l.amenityNonRf);
        if (row.allow_children) amenityLabels.push(l.amenityChildren);

        return {
          id: row.id,
          href: `/${locale}/browse/${row.id}`,
          photoUrl: photoPath ? listingPhotoUrl(photoPath) : null,
          neighborhood: row.neighborhood ?? '',
          crossStreets: row.cross_streets ?? '',
          rentLabel: row.monthly_rent != null ? formatRubles(row.monthly_rent, { perMonth: true }) : '',
          typeLabel: row.type ? typeLabels[row.type as ListingTypeValue] ?? row.type : '',
          sqftLabel: row.sqft != null ? `${row.sqft} м²` : null,
          negotiating: row.status === 'negotiating',
          negotiatingLabel: b.statusNegotiating,
          amenityLabels,
          availableLabel: row.available_from
            ? b.availableFrom.replace(
                '{date}',
                new Date(`${row.available_from}T00:00:00`).toLocaleDateString(dateLocale, {
                  month: 'short',
                  day: 'numeric',
                })
              )
            : null,
          gratuityLabel: row.gratitude_amount != null ? formatRubles(row.gratitude_amount) : null,
          verified: verifiedListers.has(row.lister_id),
          favourited: true,
          favouriteAddLabel: b.favouriteAdd,
          favouriteRemoveLabel: b.favouriteRemove,
        };
      });

      setCards(nextCards);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // On the Saved page, un-hearting removes the card from the list.
  async function handleToggleFavourite(listingId: string) {
    if (!userId) return;
    const removed = cards.find((c) => c.id === listingId);
    setCards((cur) => cur.filter((c) => c.id !== listingId));
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from('favourites')
      .delete()
      .eq('seeker_id', userId)
      .eq('listing_id', listingId);
    if (delErr && removed) setCards((cur) => [removed, ...cur]); // revert on failure
  }

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-6">
      <h1 className="mb-6 font-display text-3xl font-bold text-ink">{s.title}</h1>

      {error && (
        <p role="alert" className="mb-6 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="font-mono text-sm text-muted">{s.loading}</p>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-10 text-center">
          <p className="mb-1 font-display text-xl font-bold text-ink">{s.emptyTitle}</p>
          <p className="mb-6 text-sm text-muted">{s.emptyBody}</p>
          <Link
            href={`/${locale}/browse`}
            className="inline-block rounded-lg bg-gradient-cobalt px-5 py-3 font-semibold text-white transition hover:brightness-110"
          >
            {s.browseCta}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <ListingCard key={card.id} listing={card} onToggleFavourite={handleToggleFavourite} />
          ))}
        </div>
      )}
    </main>
  );
}
