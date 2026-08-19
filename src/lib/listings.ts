import { createClient } from '@/lib/supabase/client';

export const LISTING_TYPES = ['room', 'studio', '1br', '2br', '3br_plus'] as const;
export type ListingTypeValue = (typeof LISTING_TYPES)[number];

// Canonical set of cities we support. The listing form picks from this list
// (no free text) so city values stay consistent across listings and the filter.
export const SUPPORTED_CITIES = [
  'New York City',
  'Chicago',
  'Los Angeles',
  'San Diego',
  'Miami',
  'Fort Lauderdale',
  'Seattle',
  'Boston',
  'New Jersey',
] as const;

// ZIP → canonical city, defined as numeric ranges over the 5-digit ZIP (leading
// zeros drop out via parseInt, e.g. "02108" → 2108). Covers each city's core;
// suburbs of the same metro are intentionally excluded. Add ranges to extend.
const ZIP_CITY_RANGES: { min: number; max: number; city: string }[] = [
  // New York City
  { min: 10001, max: 10292, city: 'New York City' }, // Manhattan
  { min: 10301, max: 10314, city: 'New York City' }, // Staten Island
  { min: 10451, max: 10475, city: 'New York City' }, // Bronx
  { min: 11004, max: 11109, city: 'New York City' }, // Queens (west)
  { min: 11201, max: 11256, city: 'New York City' }, // Brooklyn
  { min: 11351, max: 11697, city: 'New York City' }, // Queens
  // Chicago
  { min: 60601, max: 60827, city: 'Chicago' },
  // Los Angeles
  { min: 90001, max: 90089, city: 'Los Angeles' },
  { min: 90090, max: 90096, city: 'Los Angeles' },
  { min: 90189, max: 90189, city: 'Los Angeles' },
  { min: 91040, max: 91043, city: 'Los Angeles' }, // Sunland/Tujunga
  { min: 91300, max: 91499, city: 'Los Angeles' }, // San Fernando Valley (LA)
  // San Diego
  { min: 92037, max: 92037, city: 'San Diego' }, // La Jolla
  { min: 92101, max: 92199, city: 'San Diego' },
  // Miami
  { min: 33101, max: 33199, city: 'Miami' },
  // Fort Lauderdale
  { min: 33301, max: 33351, city: 'Fort Lauderdale' },
  // Seattle
  { min: 98101, max: 98199, city: 'Seattle' },
  // Boston
  { min: 2108, max: 2137, city: 'Boston' },
  { min: 2163, max: 2163, city: 'Boston' },
  { min: 2199, max: 2199, city: 'Boston' },
  { min: 2203, max: 2203, city: 'Boston' },
  { min: 2210, max: 2210, city: 'Boston' },
  { min: 2215, max: 2215, city: 'Boston' },
  { min: 2222, max: 2222, city: 'Boston' },
  // New Jersey — state-wide (07xxx–08xxx), a catch-all rather than a single city.
  { min: 7001, max: 8989, city: 'New Jersey' },
];

// The launch city — default selection for the Browse city filter and the form.
export const DEFAULT_CITY = 'New York City';

// Collapse common spellings/aliases to a canonical city so old free-text values
// ("New York", "NYC", "NY") unify with the canonical name. Unknown values are
// returned trimmed as-is.
export function normalizeCity(input: string | null | undefined): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  const key = s.toLowerCase().replace(/\./g, '');
  if (['new york', 'new york city', 'nyc', 'ny', 'new york, ny'].includes(key)) return DEFAULT_CITY;
  return s;
}

// Best-effort city from a ZIP, used as the fallback when a lister doesn't set
// the city field. Keep in sync with the backfill in migration 0031. Returns
// null for ZIPs we don't recognize (city stays whatever the lister entered).
export function cityFromZip(zip: string | null | undefined): string | null {
  const n = parseInt((zip ?? '').trim(), 10);
  if (Number.isNaN(n)) return null;
  return ZIP_CITY_RANGES.find((r) => n >= r.min && n <= r.max)?.city ?? null;
}

const PHOTO_BUCKET = 'listing-photos';

export function listingPhotoUrl(storagePath: string): string {
  const supabase = createClient();
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

type TypeLabelDict = {
  typeRoom: string;
  typeStudio: string;
  type1br: string;
  type2br: string;
  type3brPlus: string;
};

export function listingTypeLabels(l: TypeLabelDict): Record<ListingTypeValue, string> {
  return {
    room: l.typeRoom,
    studio: l.typeStudio,
    '1br': l.type1br,
    '2br': l.type2br,
    '3br_plus': l.type3brPlus,
  };
}

export function listingTypeLabel(type: string | null, l: TypeLabelDict): string {
  if (!type) return '';
  return listingTypeLabels(l)[type as ListingTypeValue] ?? type;
}

export type BrowseFilters = {
  rentMin: string;
  rentMax: string;
  bathrooms: string; // minimum bathrooms ('', '1', '2', '3')
  zip: string;
  moveInBy: string;
  laundry: boolean;
  petsOk: boolean;
  elevator: boolean;
  walkUp: boolean;
  doorman: boolean;
  outdoor: boolean;
};

export const EMPTY_FILTERS: BrowseFilters = {
  rentMin: '',
  rentMax: '',
  bathrooms: '',
  zip: '',
  moveInBy: '',
  laundry: false,
  petsOk: false,
  elevator: false,
  walkUp: false,
  doorman: false,
  outdoor: false,
};

export function hasActiveFilters(filters: BrowseFilters): boolean {
  return Object.entries(filters).some(([key, value]) =>
    typeof value === 'boolean' ? value : value.trim() !== ''
  );
}
