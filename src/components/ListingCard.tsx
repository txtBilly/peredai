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
  return (
    <article className="relative overflow-hidden rounded-xl border border-black/[0.08] bg-white">
      <Link href={listing.href} className="block">
        <div className="relative aspect-[4/3] w-full bg-black/[0.04]">
          {listing.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-ink/25">—</div>
          )}
          {listing.availableLabel && (
            <span className="absolute left-2.5 top-2.5 rounded-md bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
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

        <div className="flex flex-col gap-2 p-5">
          {/* Price leads, StreetEasy-style */}
          <div className="mb-0.5 font-display text-2xl font-bold leading-tight text-ink">{listing.rentLabel}</div>

          {/* Facts row: type · neighborhood · area */}
          <div className="text-[15px] leading-snug text-ink">
            <span className="font-semibold">{listing.typeLabel}</span>
            {listing.neighborhood && (
              <>
                <span className="px-1.5 text-muted">·</span>
                {listing.neighborhood}
              </>
            )}
            {listing.sqftLabel && (
              <>
                <span className="px-1.5 text-muted">·</span>
                {listing.sqftLabel}
              </>
            )}
          </div>

          {/* Nearest metro / cross-streets on its own line */}
          {listing.crossStreets && (
            <div className="text-[15px] leading-snug text-muted">{listing.crossStreets}</div>
          )}

          {/* Amenity chiclets */}
          {listing.amenityLabels.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1.5">
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

          {/* Verified ID + Gratuity */}
          {(listing.verified || listing.gratuityLabel) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {listing.verified && <span className="text-sm font-semibold text-leaf">✓ Личность подтверждена</span>}
              {listing.gratuityLabel && (
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Благодарность {listing.gratuityLabel}
                </span>
              )}
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
