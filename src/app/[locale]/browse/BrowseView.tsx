'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDictionary, intlLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { formatRubles } from '@/lib/format';
import {
  DEFAULT_CITY,
  normalizeCity,
  EMPTY_FILTERS,
  LANGUAGE_OPTIONS,
  LISTING_TYPES,
  listingPhotoUrl,
  listingTypeLabels,
  type BrowseFilters,
  type ListingTypeValue,
} from '@/lib/listings';
import { ListingCard, type ListingCardData } from '@/components/ListingCard';
import { NewListingsTicker, type TickerItem } from '@/components/NewListingsTicker';
import { PullToRefresh } from '@/components/PullToRefresh';
import { FiltersSheet } from '@/components/FiltersSheet';
import { useHideOnScroll } from '@/lib/useHideOnScroll';

type ListingRow = {
  id: string;
  lister_id: string;
  neighborhood: string | null;
  cross_streets: string | null;
  type: string | null;
  monthly_rent: number | null;
  sqft: number | null;
  available_from: string | null;
  pets_ok: boolean | null;
  laundry: boolean | null;
  doorman: boolean | null;
  elevator: boolean | null;
  outdoor: boolean | null;
  no_fee: boolean | null;
  walk_up: boolean | null;
  allow_non_rf: boolean | null;
  allow_children: boolean | null;
  gratitude_amount: number | null;
  status: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BrowseView({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const b = d.browse;
  const l = d.listing;
  const router = useRouter();

  const typeLabels = listingTypeLabels(l);

  const [userId, setUserId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [city, setCity] = useState<string>(DEFAULT_CITY); // '' = all cities
  const [cityOptions, setCityOptions] = useState<string[]>([DEFAULT_CITY]);
  const [typeFilter, setTypeFilter] = useState<'all' | ListingTypeValue>('all');
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  // Auto-hide the filter bar in lockstep with the top nav (see useHideOnScroll).
  const controlsHidden = useHideOnScroll();

  const [cards, setCards] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pull-to-refresh: bumping refreshKey re-runs the listings + ticker queries.
  // handleRefresh resolves once the listings fetch finishes (via the resolver
  // ref, called at the fetch's exit points) so the spinner reflects real work.
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshResolveRef = useRef<null | (() => void)>(null);
  const handleRefresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        refreshResolveRef.current = resolve;
        setRefreshKey((k) => k + 1);
      }),
    []
  );

  // Newest-listings ticker — follows the selected city (so the strip always
  // matches the shelf below), but is otherwise independent of the search/type
  // filters. Most-recent live listings, newest first; hides itself when empty.
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    let tickerQuery = createClient()
      .from('listings')
      .select('id, neighborhood, type, monthly_rent, available_from, created_at')
      .in('status', ['active', 'negotiating']);
    if (city) tickerQuery = tickerQuery.eq('city', city); // '' = all cities
    tickerQuery
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const nowMs = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const items: TickerItem[] = data.map((row) => {
          const availMs = row.available_from
            ? new Date(`${row.available_from as string}T00:00:00`).getTime()
            : null;
          const meta =
            availMs == null
              ? null
              : availMs <= nowMs
                ? locale === 'en'
                  ? 'available now'
                  : 'доступна сейчас'
                : `${locale === 'en' ? 'from ' : 'с '}${new Date(
                    `${row.available_from as string}T00:00:00`
                  ).toLocaleDateString(intlLocale(locale), { month: 'short', day: 'numeric' })}`;
          const typeLabel = row.type ? typeLabels[row.type as ListingTypeValue] ?? (row.type as string) : '';
          return {
            id: row.id as string,
            href: `/${locale}/browse/${row.id}`,
            primary: [typeLabel, row.neighborhood as string | null].filter(Boolean).join(', '),
            rentLabel: row.monthly_rent != null ? formatRubles(row.monthly_rent as number, { perMonth: true }) : '',
            metaLabel: meta,
            fresh: row.created_at ? nowMs - new Date(row.created_at as string).getTime() < dayMs : false,
            freshLabel: locale === 'en' ? 'just now' : 'только что',
          };
        });
        setTickerItems(items);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, typeLabels, refreshKey, city]);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  // Build the city dropdown from the cities that actually have live listings,
  // always including the launch city so the default selection is valid.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from('listings')
      .select('city')
      .in('status', ['active', 'negotiating'])
      .not('city', 'is', null)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const unique = Array.from(
          new Set([
            DEFAULT_CITY,
            ...data.map((r) => normalizeCity(r.city as string | null)).filter((c): c is string => !!c),
          ])
        ).sort();
        setCityOptions(unique);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search + immediate re-query on type/filters change. All
  // filtering happens in the Supabase query itself (server-side), not by
  // filtering the array client-side after the fact.
  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(
      async () => {
        setLoading(true);
        setError('');
        const supabase = createClient();

        let query = supabase
          .from('listings')
          .select(
            'id, lister_id, neighborhood, cross_streets, type, monthly_rent, sqft, available_from, pets_ok, laundry, doorman, elevator, outdoor, no_fee, walk_up, allow_non_rf, allow_children, gratitude_amount, status'
          )
          .in('status', ['active', 'negotiating'])
          // Default sort: soonest available date first. Listings with no date go
          // last (nullsFirst: false); ties break by newest-listed.
          .order('available_from', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(60);

        const q = searchText.trim().replace(/[%,()]/g, '');
        if (q) {
          query = query.or(`neighborhood.ilike.%${q}%,cross_streets.ilike.%${q}%`);
        }
        if (city) query = query.eq('city', city); // '' = all cities
        if (typeFilter !== 'all') query = query.eq('type', typeFilter);
        if (filters.rentMin) query = query.gte('monthly_rent', Number(filters.rentMin));
        if (filters.rentMax) query = query.lte('monthly_rent', Number(filters.rentMax));
        if (filters.bathrooms) query = query.gte('bathrooms', Number(filters.bathrooms));
        if (filters.moveInBy) query = query.lte('available_from', filters.moveInBy);
        if (filters.laundry) query = query.eq('laundry', true);
        if (filters.petsOk) query = query.eq('pets_ok', true);
        if (filters.elevator) query = query.eq('elevator', true);
        if (filters.walkUp) query = query.eq('walk_up', true);
        if (filters.doorman) query = query.eq('doorman', true);
        if (filters.outdoor) query = query.eq('outdoor', true);
        if (filters.allowNonRf) query = query.eq('allow_non_rf', true);
        if (filters.allowChildren) query = query.eq('allow_children', true);

        // Language filter: Russian is the baseline (always selected), so only the
        // additional languages narrow results. Restrict to listers whose
        // spoken_languages contain ALL the selected extras (public_profile_summary
        // exposes spoken_languages), then constrain the listings query.
        const extraLanguages = filters.languages.filter((x) => x !== 'ru');
        if (extraLanguages.length > 0) {
          const { data: langListers } = await supabase
            .from('public_profile_summary')
            .select('id')
            .contains('spoken_languages', extraLanguages);
          if (cancelled) return;
          const langListerIds = (langListers ?? []).map((p) => p.id as string);
          if (langListerIds.length === 0) {
            setCards([]);
            setLoading(false);
            return;
          }
          query = query.in('lister_id', langListerIds);
        }

        const { data: rows, error: queryError } = await query;
        if (cancelled) return;

        if (queryError || !rows) {
          setError(b.errorGeneric);
          setCards([]);
          setLoading(false);
          return;
        }

        const ids = rows.map((r) => r.id);
        const listerIds = Array.from(new Set(rows.map((r) => r.lister_id)));

        const [photosResult, listersResult, favouritesResult] = await Promise.all([
          ids.length
            ? supabase
                .from('listing_photos')
                .select('listing_id, storage_path, slot, sort_order')
                .in('listing_id', ids)
                .order('sort_order', { ascending: true })
            : Promise.resolve({ data: [] as { listing_id: string; storage_path: string; slot: string }[] }),
          listerIds.length
            ? supabase.from('public_profile_summary').select('id, is_verified').in('id', listerIds)
            : Promise.resolve({ data: [] as { id: string; is_verified: boolean }[] }),
          userId && ids.length
            ? supabase.from('favourites').select('listing_id').eq('seeker_id', userId).in('listing_id', ids)
            : Promise.resolve({ data: [] as { listing_id: string }[] }),
        ]);
        if (cancelled) return;

        const photoByListing = new Map<string, string>();
        (photosResult.data ?? []).forEach((p) => {
          const current = photoByListing.get(p.listing_id);
          if (!current || p.slot === 'bedroom') photoByListing.set(p.listing_id, p.storage_path);
        });

        const verifiedListers = new Set((listersResult.data ?? []).filter((p) => p.is_verified).map((p) => p.id));
        const favouritedIds = new Set((favouritesResult.data ?? []).map((f) => f.listing_id));

        const dateLocale = intlLocale(locale);
        // Highlight the availability badge when the move-in date is under 5 days
        // out (including dates already reached — those are the most urgent).
        const nowMs = Date.now();
        const soonCutoffMs = 5 * 24 * 60 * 60 * 1000;

        const nextCards: ListingCardData[] = rows.map((row: ListingRow) => {
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
            availableSoon: row.available_from
              ? new Date(`${row.available_from}T00:00:00`).getTime() - nowMs < soonCutoffMs
              : false,
            gratuityLabel:
              row.gratitude_amount != null ? formatRubles(row.gratitude_amount) : null,
            verified: verifiedListers.has(row.lister_id),
            favourited: favouritedIds.has(row.id),
            favouriteAddLabel: b.favouriteAdd,
            favouriteRemoveLabel: b.favouriteRemove,
          };
        });

        setCards(nextCards);
        setLoading(false);
      },
      searchText ? 400 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, city, typeFilter, filters, userId, locale, refreshKey]);

  // Resolve a pending pull-to-refresh once the listings fetch settles.
  useEffect(() => {
    if (!loading && refreshResolveRef.current) {
      refreshResolveRef.current();
      refreshResolveRef.current = null;
    }
  }, [loading]);

  async function handleToggleFavourite(listingId: string, currentlyFavourited: boolean) {
    if (!userId) {
      router.push(`/${locale}/signin`);
      return;
    }
    setCards((cur) => cur.map((c) => (c.id === listingId ? { ...c, favourited: !currentlyFavourited } : c)));
    const supabase = createClient();
    const { error: toggleError } = currentlyFavourited
      ? await supabase.from('favourites').delete().eq('seeker_id', userId).eq('listing_id', listingId)
      : await supabase.from('favourites').insert({ seeker_id: userId, listing_id: listingId });

    if (toggleError) {
      setCards((cur) => cur.map((c) => (c.id === listingId ? { ...c, favourited: currentlyFavourited } : c)));
    }
  }

  const typeChips: { value: 'all' | ListingTypeValue; label: string }[] = [
    { value: 'all', label: b.typeAll },
    ...LISTING_TYPES.map((value) => ({ value, label: typeLabels[value] })),
  ];

  // Active-filter chips: one per applied filter, each removable; plus Reset all.
  const amenityChips: [keyof BrowseFilters, string][] = [
    ['laundry', l.amenityLaundry],
    ['petsOk', l.amenityPetsOk],
    ['elevator', l.amenityElevator],
    ['walkUp', l.amenityWalkUp],
    ['doorman', l.amenityDoorman],
    ['outdoor', l.amenityOutdoor],
    ['allowNonRf', l.amenityNonRf],
    ['allowChildren', l.amenityChildren],
  ];
  const activeChips: { key: string; label: string; remove: () => void }[] = [];
  if (searchText.trim())
    activeChips.push({ key: 'q', label: `"${searchText.trim()}"`, remove: () => setSearchText('') });
  if (typeFilter !== 'all')
    activeChips.push({ key: 'type', label: typeLabels[typeFilter], remove: () => setTypeFilter('all') });
  if (filters.rentMin)
    activeChips.push({ key: 'rmin', label: `≥ ${filters.rentMin} ₽`, remove: () => setFilters((f) => ({ ...f, rentMin: '' })) });
  if (filters.rentMax)
    activeChips.push({ key: 'rmax', label: `≤ ${filters.rentMax} ₽`, remove: () => setFilters((f) => ({ ...f, rentMax: '' })) });
  if (filters.bathrooms)
    activeChips.push({ key: 'bath', label: `${filters.bathrooms}+ санузл.`, remove: () => setFilters((f) => ({ ...f, bathrooms: '' })) });
  if (filters.moveInBy)
    activeChips.push({ key: 'move', label: `by ${filters.moveInBy}`, remove: () => setFilters((f) => ({ ...f, moveInBy: '' })) });
  amenityChips.forEach(([key, label]) => {
    if (filters[key]) activeChips.push({ key, label, remove: () => setFilters((f) => ({ ...f, [key]: false })) });
  });
  // Russian is the locked baseline — only additional languages get removable chips.
  filters.languages
    .filter((lang) => lang !== 'ru')
    .forEach((lang) => {
      const opt = LANGUAGE_OPTIONS.find((o) => o.value === lang);
      activeChips.push({
        key: `lang:${lang}`,
        label: opt?.label ?? lang,
        remove: () => setFilters((f) => ({ ...f, languages: f.languages.filter((x) => x !== lang) })),
      });
    });
  const resetAll = () => {
    setSearchText('');
    setTypeFilter('all');
    setFilters(EMPTY_FILTERS);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={filtersOpen}>
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-6">
      {/* Newest-listings running line — sits between the header and the search
          bar, spans the container edge-to-edge, and hides itself when empty. */}
      <div className="-mx-5 -mt-6 mb-4">
        <NewListingsTicker
          items={tickerItems}
          label={locale === 'en' ? 'New listings' : 'Новые объявления'}
        />
      </div>

      {/* Search + filters + view toggle — sticky just below the auto-hiding nav
          (top-[61px] = nav height) so filters stay reachable on scroll-up. */}
      <div
        className={`sticky top-[61px] z-30 -mx-5 bg-white/95 px-5 py-2 backdrop-blur transition-transform duration-300 will-change-transform ${
          controlsHidden ? '-translate-y-[calc(100%+70px)]' : 'translate-y-0'
        }`}
      >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={b.searchPlaceholder}
          aria-label={b.searchPlaceholder}
          className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base text-ink placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-cobalt sm:flex-1"
        />
        {/* Filters + view toggle share one row (esp. on mobile). */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="shrink-0 rounded-lg border border-black/15 bg-white px-4 py-2.5 text-sm font-medium text-ink hover:border-black/30"
          >
            {b.filtersCta}
          </button>
          <div className="flex shrink-0 gap-1">
            {(['list', 'grid'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-lg border px-3 py-2.5 text-sm transition ${
                  view === v ? 'border-cobalt bg-cobalt/10 font-semibold text-cobalt' : 'border-black/15 text-muted hover:border-black/30'
                }`}
              >
                {locale === 'en' ? (v === 'list' ? 'List' : 'Grid') : v === 'list' ? 'Список' : 'Плитка'}
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Scope row: city selector pill + type tabs */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* City filter — a pill-styled select leading the type tabs */}
        <div className="relative shrink-0">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cobalt"
            fill="currentColor"
          >
            <path d="M12 2c-3.9 0-7 3.1-7 7 0 5 7 13 7 13s7-8 7-13c0-3.9-3.1-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
          </svg>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label={b.cityFilterLabel}
            className="appearance-none rounded-full border border-black/20 bg-white py-1.5 pl-8 pr-7 text-[13px] font-medium text-ink transition hover:border-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt sm:py-2 sm:pl-9 sm:pr-8 sm:text-[15px]"
          >
            <option value="">{b.cityAll}</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted">▾</span>
        </div>

        <span className="mx-1 hidden h-6 w-px bg-black/10 sm:block" aria-hidden="true" />

        {typeChips.map(({ value, label }) => {
          const selected = typeFilter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTypeFilter(value)}
              aria-pressed={selected}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition sm:px-5 sm:py-2 sm:text-[15px] ${
                selected
                  ? 'bg-cobalt font-bold text-white shadow-sm ring-1 ring-cobalt'
                  : 'border border-black/20 bg-white font-medium text-ink hover:border-black/40'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.remove}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 text-sm text-ink/80 hover:border-black/25"
            >
              {chip.label}
              <span className="text-cobalt" aria-hidden="true">✕</span>
            </button>
          ))}
          <button
            type="button"
            onClick={resetAll}
            className="font-mono text-[11px] font-semibold uppercase tracking-wide text-red-500 hover:text-red-600"
          >
            {b.clearFiltersCta}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="font-mono text-sm text-muted">{b.loading}</p>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-black/10 bg-white p-8 text-center">
            <p className="mb-1 font-display text-xl font-bold text-ink">{b.noResultsTitle}</p>
            <p className="text-sm text-muted">{b.noResultsBody}</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <ListingCard key={card.id} listing={card} onToggleFavourite={handleToggleFavourite} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-black/[0.07] overflow-hidden rounded-xl border border-black/10 bg-white">
            {cards.map((card) => (
              <div key={card.id} className="flex items-center gap-2 px-4 py-3 transition hover:bg-black/[0.02]">
                <Link href={card.href} className="flex min-w-0 flex-1 items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="block truncate text-base font-bold text-cobalt">{card.neighborhood || '—'}</span>
                    <p className="truncate font-mono text-[13px] text-muted">
                      {[card.typeLabel, card.neighborhood, card.sqftLabel, card.crossStreets, card.availableLabel]
                        .filter(Boolean)
                        .join(' · ')}
                      {card.verified && <span className="font-semibold text-leaf"> · ✓ проверен</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-display text-lg font-bold text-ink">{card.rentLabel}</span>
                    {card.negotiating && (
                      <span className="whitespace-nowrap rounded-full bg-cobalt px-2 py-0.5 text-[11px] font-semibold text-white">
                        {card.negotiatingLabel}
                      </span>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  aria-pressed={card.favourited}
                  aria-label={card.favourited ? card.favouriteRemoveLabel : card.favouriteAddLabel}
                  onClick={() => handleToggleFavourite(card.id, card.favourited)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-black/[0.05]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={card.favourited ? 'url(#heartGradList)' : 'none'} aria-hidden="true">
                    <defs>
                      <linearGradient id="heartGradList" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#A21CAF" />
                        <stop offset="1" stopColor="#EC4899" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M12 20.5s-7.5-4.6-10-9.3C.6 8 2 4.5 5.4 3.6c2-.5 4 .3 5.1 2 .3.4.7.4 1 0 1.1-1.7 3.1-2.5 5.1-2 3.4.9 4.8 4.4 3.4 7.6-2.5 4.7-10 9.3-10 9.3Z"
                      stroke="url(#heartGradList)"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <FiltersSheet
        open={filtersOpen}
        filters={filters}
        todayStr={todayStr()}
        labels={{
          title: b.filtersTitle,
          rentMin: b.rentMinLabel,
          rentMax: b.rentMaxLabel,
          bathrooms: b.bathroomsFilterLabel,
          moveInBy: b.moveInByLabel,
          laundry: l.amenityLaundry,
          petsOk: l.amenityPetsOk,
          elevator: l.amenityElevator,
          walkUp: l.amenityWalkUp,
          doorman: l.amenityDoorman,
          outdoor: l.amenityOutdoor,
          allowNonRf: l.amenityNonRf,
          allowChildren: l.amenityChildren,
          languages: locale === 'en' ? 'Speaks:' : 'Говорит на:',
          // Short labels so the sheet's action buttons stay on one line on mobile.
          apply: locale === 'en' ? 'Apply' : 'Применить',
          clear: locale === 'en' ? 'Reset' : 'Сбросить',
          close: b.closeCta,
        }}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </main>
    </PullToRefresh>
  );
}
