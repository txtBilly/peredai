'use client';

import Link from 'next/link';

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'url(#heartGrad)' : 'none'} aria-hidden="true">
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
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="-mt-px inline-block shrink-0">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v9h14v-9M12 8S10.5 3 7.5 4.5 9 8 12 8Zm0 0s1.5-5 4.5-3.5S15 8 12 8Z" />
    </svg>
  );
}

export type ListingCardData = {
  id: string;
  href: string;
  photoUrl: string | null;
  neighborhood: string;
  crossStreets: string;
  rentLabel: string;
  typeLabel: string;
  sqftLabel: string | null;
  negotiating: boolean;
  negotiatingLabel: string;
  amenityLabels: string[];
  availableLabel: string | null;
  availableSoon: boolean; // < 5 days until available → highlight the date badge
  gratuityLabel: string | null;
  verified: boolean;
  favourited: boolean;
  favouriteAddLabel: string;
  favouriteRemoveLabel: string;
};

export function ListingCard({
  listing,
  onToggleFavourite,
}: {
  listing: ListingCardData;
  onToggleFavourite: (id: string, currentlyFavourited: boolean) => void;
}) {
  // rentLabel comes formatted as "40 000 ₽/мес"; split the suffix so it can be
  // rendered smaller and muted next to the amount.
  const PER_MONTH = '/мес';
  const hasPerMonth = listing.rentLabel.endsWith(PER_MONTH);
  const rentAmount = hasPerMonth ? listing.rentLabel.slice(0, -PER_MONTH.length).trim() : listing.rentLabel;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-black/[0.08] bg-white">
      <Link href={listing.href} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/3] w-full bg-black/[0.04]">
          {listing.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-ink/25">—</div>
          )}
          {listing.availableLabel && (
            <span
              className={`absolute left-2.5 top-2.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm ${
                listing.availableSoon ? 'shadow-sm' : 'bg-black/70'
              }`}
              style={
                listing.availableSoon
                  ? { backgroundImage: 'linear-gradient(135deg,#1B4DE4 0%,#7C3AED 55%,#D946EF 100%)' }
                  : undefined
              }
            >
              {listing.availableLabel}
            </span>
          )}
          {listing.negotiating && (
            <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-cobalt shadow-sm backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cobalt opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cobalt" />
              </span>
              {listing.negotiatingLabel}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-5">
          {/* Price row: rent on the left (smaller & slimmer), metro pushed to the
              right on the same line. Metro truncates so it never overflows. */}
          <div className="flex items-baseline justify-between gap-2 leading-none">
            <span className="shrink-0">
              <span className="font-display text-[19px] font-semibold text-ink">{rentAmount}</span>
              {hasPerMonth && <span className="ml-1 text-sm font-medium text-muted">/ мес</span>}
            </span>
            {listing.crossStreets && (
              <span className="flex min-w-0 shrink items-center gap-1 text-[13px] text-muted">
                <PinIcon />
                <span className="truncate">{listing.crossStreets}</span>
              </span>
            )}
          </div>

          {/* Facts row: type · neighborhood · area. Wrapping flex row; each "· X"
              is a nowrap segment so it breaks cleanly with no dangling separators. */}
          <div className="flex flex-wrap items-baseline gap-y-0.5 text-[15px] leading-snug text-ink">
            <span className="font-semibold">{listing.typeLabel}</span>
            {listing.neighborhood && (
              <span className="whitespace-nowrap">
                <span className="px-1.5 text-muted">·</span>
                {listing.neighborhood}
              </span>
            )}
            {listing.sqftLabel && (
              <span className="whitespace-nowrap">
                <span className="px-1.5 text-muted">·</span>
                {listing.sqftLabel}
              </span>
            )}
          </div>

          {/* Amenity chiclets */}
          {listing.amenityLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.amenityLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-md border border-black/10 bg-black/[0.02] px-2 py-0.5 text-xs font-medium text-ink/70"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Footer: hairline, then verified (left) + gratuity plate (right).
              mt-auto pins it to the bottom of the tile so footers line up across a
              row (extra height sits above it, not as odd trailing space below).
              flex-wrap so a narrow card drops the plate to its own line instead
              of overflowing/clipping; shrink-0 keeps each item intact. */}
          {(listing.verified || listing.gratuityLabel) && (
            <div className="mt-auto">
              <div className="h-px bg-black/[0.08]" />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                {listing.verified ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-leaf">
                    <CheckIcon /> Подтверждён
                  </span>
                ) : (
                  <span />
                )}
                {listing.gratuityLabel && (
                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#7C3AED]/[0.09] px-2 py-1 text-[11px] font-semibold text-[#6D28D9]">
                    <GiftIcon /> Благодарность {listing.gratuityLabel}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        aria-pressed={listing.favourited}
        aria-label={listing.favourited ? listing.favouriteRemoveLabel : listing.favouriteAddLabel}
        onClick={() => onToggleFavourite(listing.id, listing.favourited)}
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 backdrop-blur transition ${
          listing.favourited ? 'text-cobalt' : 'text-ink/60 hover:text-cobalt'
        }`}
      >
        <HeartIcon filled={listing.favourited} />
      </button>
    </article>
  );
}
