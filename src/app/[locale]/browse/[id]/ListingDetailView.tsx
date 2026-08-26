'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDictionary, intlLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { listingPhotoUrl, listingTypeLabel } from '@/lib/listings';
import { formatRubles } from '@/lib/format';

const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Русский',
  uz: 'Oʻzbekcha',
  tg: 'Тоҷикӣ',
  en: 'English',
  es: 'Español',
  zh: '中文',
  fr: 'Français',
  pt: 'Português',
  ar: 'العربية',
  ko: '한국어',
};

type ListingDetail = {
  id: string;
  lister_id: string;
  neighborhood: string | null;
  cross_streets: string | null;
  city: string | null;
  full_address: string | null;
  type: string | null;
  monthly_rent: number | null;
  floor: string | null;
  sqft: number | null;
  bathrooms: number | null;
  description: string | null;
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

type Lister = {
  display_first_name: string;
  is_verified: boolean;
  rating_avg: number | null;
  rating_count: number;
  spoken_languages: string[] | null;
};

export default function ListingDetailView({ locale, id }: { locale: Locale; id: string }) {
  const d = getDictionary(locale);
  const l = d.listing;
  const b = d.browse;
  const dd = d.listingDetail;
  const router = useRouter();

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lister, setLister] = useState<Lister | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(true); // assume ok until known
  const [resendState, setResendState] = useState<'idle' | 'sent'>('idle');
  const [favourited, setFavourited] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [seekerVerified, setSeekerVerified] = useState(false);
  const [seekerCreditBalance, setSeekerCreditBalance] = useState(0);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [listingChatId, setListingChatId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [notifyRequested, setNotifyRequested] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyError, setNotifyError] = useState('');

  useEffect(() => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      setError(dd.errorGeneric);
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
      setUserId(user?.id ?? null);
      setEmailConfirmed(!user || !!user.email_confirmed_at);

      const { data: row, error: listingError } = await supabase
        .from('listings')
        .select(
          'id, lister_id, neighborhood, cross_streets, city, full_address, type, monthly_rent, floor, sqft, bathrooms, description, available_from, pets_ok, laundry, doorman, elevator, outdoor, no_fee, walk_up, allow_non_rf, allow_children, gratitude_amount, status'
        )
        .eq('id', id)
        .single();
      if (settled) return;

      if (listingError || !row || !['active', 'negotiating'].includes(row.status)) {
        // Not viewable (missing, or closed/suspended/removed). Show a clear
        // state rather than notFound() — which, thrown from this async load,
        // gets swallowed by the catch below and hangs on "Loading…".
        if (!finish()) return;
        setError(dd.errorUnavailable);
        setPhase('error');
        return;
      }

      const [photosResult, listerResult, favouriteResult, profileResult, creditResult, chatResult, listingChatResult] =
        await Promise.all([
        supabase
          .from('listing_photos')
          .select('storage_path, slot, sort_order')
          .eq('listing_id', id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('public_profile_summary')
          .select('display_first_name, is_verified, rating_avg, rating_count, spoken_languages')
          .eq('id', row.lister_id)
          .single(),
        user
          ? supabase.from('favourites').select('listing_id').eq('seeker_id', user.id).eq('listing_id', id).maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase
              .from('profiles')
              .select('verification_status')
              .eq('id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('credit_ledger').select('amount').eq('seeker_id', user.id)
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('chats').select('id').eq('seeker_id', user.id).eq('status', 'active').maybeSingle()
          : Promise.resolve({ data: null }),
        // The active chat on THIS listing (readable only by its participants —
        // so effectively the lister here). Powers the owner's "Go to chat".
        user
          ? supabase.from('chats').select('id').eq('listing_id', id).eq('status', 'active').maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (settled) return;

      if (!finish()) return;
      setListing(row);
      setPhotos((photosResult.data ?? []).map((p) => listingPhotoUrl(p.storage_path)));
      setLister(listerResult.data ?? null);
      setFavourited(!!favouriteResult.data);
      const prof = profileResult.data as { verification_status: string | null } | null;
      // Match the server's open_connect_chat check: identity-verified (OAuth ID).
      setSeekerVerified(prof?.verification_status === 'verified');
      const ledgerRows = (creditResult.data as { amount: number }[] | null) ?? [];
      setSeekerCreditBalance(ledgerRows.reduce((sum, r) => sum + r.amount, 0));
      setActiveChatId((chatResult.data as { id: string } | null)?.id ?? null);
      setListingChatId((listingChatResult.data as { id: string } | null)?.id ?? null);
      setPhase('ready');
    }

    load().catch(() => {
      if (!finish()) return;
      setError(dd.errorGeneric);
      setPhase('error');
    });

    return () => {
      settled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, locale]);

  async function handleToggleFavourite() {
    if (!userId) {
      router.push(`/${locale}/signin`);
      return;
    }
    const next = !favourited;
    setFavourited(next);
    const supabase = createClient();
    const { error: toggleError } = next
      ? await supabase.from('favourites').insert({ seeker_id: userId, listing_id: id })
      : await supabase.from('favourites').delete().eq('seeker_id', userId).eq('listing_id', id);
    if (toggleError) setFavourited(!next);
  }

  // Checkout path: a seeker who still needs verification or credits is sent to
  // buy the contact-credit bundle (first purchase includes the $35 check).
  function handleConnectSubmit(e: FormEvent<HTMLFormElement>) {
    if (!userId) {
      e.preventDefault();
      router.push(`/${locale}/signin`);
    }
    // else: let the form POST to /api/checkout and follow the redirect to Stripe.
  }

  // Direct connect: a verified seeker who has a credit and meets the minimum
  // opens the chat atomically (server consumes the credit + locks the listing).
  async function handleConnect() {
    setConnectError('');
    setConnecting(true);
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        const reasons: Record<string, string> = {
          no_credits: 'У вас нет токенов на контакты.',
          active_chat_exists: 'У вас уже есть активный диалог.',
          not_verified: 'Сначала нужно пройти проверку личности.',
          listing_unavailable: 'This listing is no longer available.',
          own_listing: "You can't connect to your own listing.",
          listing_not_found: 'Listing not found.',
          email_unconfirmed: dd.emailConfirmBody,
          // Deliberately vague — a shadow-banned member must not learn they're
          // restricted. Reads like a transient glitch.
          account_restricted: 'We couldn’t complete that right now. Please try again later.',
        };
        if (data?.error === 'email_unconfirmed') setEmailConfirmed(false);
        setConnectError(reasons[data?.error] ?? `${dd.connectErrorGeneric} (${data?.error ?? 'error'})`);
        setConnecting(false);
        return;
      }
      router.push(`/${locale}/chats/${data.chatId}`);
    } catch {
      setConnectError(dd.connectErrorGeneric);
      setConnecting(false);
    }
  }

  // Re-send the signup confirmation email for an unconfirmed account.
  async function handleResendConfirmation() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase.auth.resend({ type: 'signup', email: user.email });
    setResendState('sent');
  }

  // Waitlist for a listing that's currently "in conversation": we favourite it
  // (the saved-listing set is what the "listing freed" alert notifies) so the
  // seeker gets an email the moment it returns to the market.
  async function handleNotifyAvailable() {
    if (!userId) {
      router.push(`/${locale}/signin`);
      return;
    }
    setNotifyError('');
    setNotifyBusy(true);
    const supabase = createClient();
    // Already saved → they're already on the alert list; otherwise add them.
    // A duplicate (23505) is fine — it means they were already favourited.
    if (!favourited) {
      const { error: favError } = await supabase
        .from('favourites')
        .insert({ seeker_id: userId, listing_id: id });
      if (favError && favError.code !== '23505') {
        setNotifyBusy(false);
        setNotifyError(dd.notifyAvailableError);
        return;
      }
    }
    // Make sure a notification pref row exists so the "listing freed" alert can
    // actually reach them. Seed defaults only when absent — never overwrite an
    // existing choice. (Defaults enable email for listing_freed.)
    const { data: prefRow } = await supabase
      .from('notification_prefs')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!prefRow) {
      await supabase.from('notification_prefs').insert({ user_id: userId });
    }
    setNotifyBusy(false);
    setFavourited(true);
    setNotifyRequested(true);
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-5 text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-cobalt">Ten2Ten</p>
        <p className="text-sm text-muted">{dd.loading}</p>
      </main>
    );
  }

  if (phase === 'error' || !listing) {
    return (
      <div className="min-h-screen">
        <header className="flex items-center justify-between border-b border-black/10 px-5 py-3">
          <Link href={`/${locale}/browse`} aria-label="Ten2Ten">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ten2ten-logo.svg?v=1" alt="Ten2Ten" className="h-[22px] w-auto" />
          </Link>
        </header>
        <main className="mx-auto flex max-w-md flex-col items-center px-5 py-16 text-center">
          <p role="alert" className="mb-6 text-sm text-red-600">
            {error || dd.errorGeneric}
          </p>
          <div className="flex w-full flex-col gap-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full rounded-lg border border-black/15 px-5 py-3 text-sm font-semibold text-ink transition hover:border-black/40 hover:bg-black/[0.03]"
            >
              <span aria-hidden="true">‹</span> {locale === 'en' ? 'Back' : 'Назад'}
            </button>
            <Link
              href={`/${locale}/browse`}
              className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {dd.backToBrowse}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const typeLabel = listingTypeLabel(listing.type, l);

  const amenityLabels: string[] = [];
  if (listing.laundry) amenityLabels.push(l.amenityLaundry);
  if (listing.pets_ok) amenityLabels.push(l.amenityPetsOk);
  if (listing.elevator) amenityLabels.push(l.amenityElevator);
  if (listing.walk_up) amenityLabels.push(l.amenityWalkUp);
  if (listing.doorman) amenityLabels.push(l.amenityDoorman);
  if (listing.outdoor) amenityLabels.push(l.amenityOutdoor);
  if (listing.allow_non_rf) amenityLabels.push(l.amenityNonRf);
  if (listing.allow_children) amenityLabels.push(l.amenityChildren);

  const dateLocale = intlLocale(locale);
  const availableLabel = listing.available_from
    ? new Date(`${listing.available_from}T00:00:00`).toLocaleDateString(dateLocale, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const ratingLabel =
    lister && lister.rating_count > 0
      ? dd.ratingLabel.replace('{avg}', String(lister.rating_avg ?? '—')).replace('{count}', String(lister.rating_count))
      : dd.noRatings;

  const languageNames = (lister?.spoken_languages ?? []).map((code) => LANGUAGE_NAMES[code] ?? code).join(', ');

  // A lister can't connect to their own listing — show a manage affordance
  // instead of the Connect button.
  const isOwner = !!userId && listing.lister_id === userId;

  const hasActiveChat = !!activeChatId;
  // Eligible to open a chat right now (no checkout needed): verified, holds a
  // credit, and isn't already in an active conversation.
  const canDirectConnect =
    !isOwner && seekerVerified && seekerCreditBalance >= 1 && !hasActiveChat;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href={`/${locale}/browse`}
        className="mb-6 inline-block font-mono text-xs uppercase tracking-wide text-muted hover:text-cobalt"
      >
        ‹ {dd.backToBrowse}
      </Link>

      {photos.length > 0 && (
        <div className="mb-6">
          {/* Main image */}
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-black/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[Math.min(activePhoto, photos.length - 1)]}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>

          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {photos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === activePhoto}
                  className={`aspect-[4/3] w-full overflow-hidden rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt ${
                    i === activePhoto ? 'ring-2 ring-cobalt' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">{listing.neighborhood}</h1>
          <p className="text-[1.4rem] leading-snug text-ink/80">
            {listing.cross_streets}
            {listing.city ? ` · ${listing.city}` : ''}
          </p>
          {listing.full_address && (
            <p className="mt-1 text-[1.05rem] leading-snug text-ink">{listing.full_address}</p>
          )}
        </div>
        <button
          type="button"
          aria-pressed={favourited}
          aria-label={favourited ? b.favouriteRemove : b.favouriteAdd}
          onClick={handleToggleFavourite}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/15 transition ${
            favourited ? 'text-cobalt' : 'text-ink/40 hover:text-cobalt'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={favourited ? 'url(#heartGrad)' : 'none'} aria-hidden="true">
            <defs>
              <linearGradient id="heartGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#A21CAF" />
                <stop offset="1" stopColor="#EC4899" />
              </linearGradient>
            </defs>
            <path
              d="M12 20.5s-7.5-4.6-10-9.3C.6 8 2 4.5 5.4 3.6c2-.5 4 .3 5.1 2 .3.4.7.4 1 0 1.1-1.7 3.1-2.5 5.1-2 3.4.9 4.8 4.4 3.4 7.6-2.5 4.7-10 9.3-10 9.3Z"
              stroke="url(#heartGrad)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-baseline gap-2 text-lg">
        <span className="font-display text-2xl font-bold text-ink">
          {listing.monthly_rent != null ? formatRubles(listing.monthly_rent, { perMonth: true }) : ''}
        </span>
        <span className="text-ink/50">·</span>
        <span className="text-ink/80">{typeLabel}</span>
        {listing.bathrooms != null && (
          <>
            <span className="text-ink/50">·</span>
            <span className="text-ink/80">
              {listing.bathrooms} {l.bathroomsLabel.toLowerCase()}
            </span>
          </>
        )}
        {listing.floor && (
          <>
            <span className="text-ink/50">·</span>
            <span className="text-ink/80">{l.floorLabel}: {listing.floor}</span>
          </>
        )}
        {listing.sqft != null && (
          <>
            <span className="text-ink/50">·</span>
            <span className="text-ink/80">{listing.sqft} {l.sqftLabel.toLowerCase()}</span>
          </>
        )}
      </div>

      {amenityLabels.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {amenityLabels.map((label) => (
            <span key={label} className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-base text-ink/80">
              {label}
            </span>
          ))}
        </div>
      )}

      {listing.description && (
        <div className="mb-6">
          <h2 className="mb-2 font-display text-2xl font-bold text-ink">{l.descriptionLabel}</h2>
          <p className="whitespace-pre-wrap text-xl leading-relaxed text-ink/80">{listing.description}</p>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-2 text-xl leading-relaxed text-ink/80">
        {availableLabel && (
          <p>{l.availableFromLabel}: {availableLabel}</p>
        )}
        {listing.gratitude_amount != null && (
          <div>
            <p>{l.gratitudeLabel}: {formatRubles(listing.gratitude_amount)}</p>
            <p className="mt-1 text-base text-muted">{l.gratitudePublicNote}</p>
          </div>
        )}
      </div>

      {lister && (
        <div className="mb-8 rounded-xl border border-black/10 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{dd.listedBy}</span>
            <span className="font-semibold text-ink">{lister.display_first_name}</span>
            {lister.is_verified && <span className="text-sm font-semibold text-leaf">✓ проверен</span>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {ratingLabel}
            {languageNames ? ` · ${dd.languagesLabel}: ${languageNames}` : ''}
          </p>
        </div>
      )}

      {isOwner ? (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="mb-2 text-sm text-muted">{dd.ownerNote}</p>
          <div className="flex flex-wrap gap-3">
            {listingChatId && (
              <Link
                href={`/${locale}/chats/${listingChatId}`}
                className="inline-block rounded-lg bg-gradient-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                {dd.goToChat}
              </Link>
            )}
            <Link
              href={`/${locale}/list/mine`}
              className="inline-block rounded-lg border border-black/15 bg-white px-4 py-2 text-sm text-ink transition hover:border-black/30"
            >
              {dd.ownerCta}
            </Link>
          </div>
        </div>
      ) : userId && !emailConfirmed ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-1 font-semibold text-amber-800">{dd.emailConfirmTitle}</p>
          <p className="mb-3 text-sm text-amber-700">{dd.emailConfirmBody}</p>
          {resendState === 'sent' ? (
            <p className="text-sm font-medium text-amber-800">{dd.emailConfirmSent}</p>
          ) : (
            <button
              type="button"
              onClick={handleResendConfirmation}
              className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
            >
              {dd.emailConfirmResend}
            </button>
          )}
        </div>
      ) : hasActiveChat ? (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="mb-2 text-sm text-muted">{dd.activeChatNote}</p>
          <Link
            href={`/${locale}/chats/${activeChatId}`}
            className="inline-block rounded-lg border border-black/15 bg-white px-4 py-2 text-sm text-ink transition hover:border-black/30"
          >
            {dd.goToChat}
          </Link>
        </div>
      ) : listing.status === 'negotiating' ? (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="mb-1 flex items-center gap-2 font-semibold text-ink">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cobalt opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cobalt" />
            </span>
            {dd.negotiatingTitle}
          </p>
          <p className="mb-3 text-sm text-muted">{dd.negotiatingBody}</p>
          {notifyRequested ? (
            <p className="rounded-lg border border-leaf/30 bg-leaf/10 px-4 py-2.5 text-sm font-medium text-leaf">
              ✓ {dd.notifyAvailableConfirm}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handleNotifyAvailable}
                disabled={notifyBusy}
                className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {dd.notifyAvailableCta}
              </button>
              {notifyError && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {notifyError}
                </p>
              )}
            </>
          )}
        </div>
      ) : userId && !seekerVerified ? (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="mb-2 text-sm text-muted">{dd.verifyToConnect}</p>
          <Link
            href={`/${locale}/verify?next=browse/${id}`}
            className="inline-block rounded-lg bg-gradient-cobalt px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {dd.verifyToConnectCta}
          </Link>
        </div>
      ) : canDirectConnect ? (
        <div>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {connecting ? dd.connecting : dd.connectCta}
          </button>
          {connectError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {connectError}
            </p>
          )}
        </div>
      ) : (
        <form action="/api/checkout" method="POST" onSubmit={handleConnectSubmit}>
          <input type="hidden" name="locale" value={locale} />
          {/* Carry the listing through the Stripe round-trip so the post-verify
              screen can send the seeker back to it (and, later, open the chat). */}
          <input type="hidden" name="listing_id" value={id} />
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-semibold text-white transition hover:brightness-110"
          >
            {dd.connectCta}
          </button>
        </form>
      )}
    </main>
  );
}
