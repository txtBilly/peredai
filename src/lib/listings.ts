import { createClient } from '@/lib/supabase/client';

export const LISTING_TYPES = ['room', 'studio', '1br', '2br', '3br_plus'] as const;
export type ListingTypeValue = (typeof LISTING_TYPES)[number];

// Canonical set of cities we support. The listing form picks from this list
// (no free text) so city values stay consistent across listings and the filter.
// Москва + Санкт-Петербург lead; the rest are major Russian cities, alphabetical.
// Add/remove freely — this is the single source of truth for the city picker.
export const SUPPORTED_CITIES = [
  'Москва',
  'Санкт-Петербург',
  'Абакан',
  'Архангельск',
  'Астрахань',
  'Барнаул',
  'Белгород',
  'Благовещенск',
  'Братск',
  'Брянск',
  'Великий Новгород',
  'Владивосток',
  'Владикавказ',
  'Владимир',
  'Волгоград',
  'Волжский',
  'Вологда',
  'Воронеж',
  'Грозный',
  'Джанкой',
  'Дзержинск',
  'Евпатория',
  'Екатеринбург',
  'Иваново',
  'Ижевск',
  'Иркутск',
  'Йошкар-Ола',
  'Казань',
  'Калининград',
  'Калуга',
  'Кемерово',
  'Керчь',
  'Киров',
  'Кострома',
  'Краснодар',
  'Красноярск',
  'Курган',
  'Курск',
  'Липецк',
  'Магнитогорск',
  'Махачкала',
  'Мурманск',
  'Набережные Челны',
  'Нальчик',
  'Нижневартовск',
  'Нижний Новгород',
  'Нижний Тагил',
  'Новокузнецк',
  'Новороссийск',
  'Новосибирск',
  'Обнинск',
  'Омск',
  'Орёл',
  'Оренбург',
  'Пенза',
  'Пермь',
  'Петрозаводск',
  'Псков',
  'Ростов-на-Дону',
  'Рязань',
  'Самара',
  'Саранск',
  'Саратов',
  'Севастополь',
  'Симферополь',
  'Смоленск',
  'Сочи',
  'Ставрополь',
  'Стерлитамак',
  'Сургут',
  'Сыктывкар',
  'Таганрог',
  'Тамбов',
  'Тверь',
  'Тольятти',
  'Томск',
  'Тула',
  'Тюмень',
  'Улан-Удэ',
  'Ульяновск',
  'Уфа',
  'Феодосия',
  'Хабаровск',
  'Чебоксары',
  'Челябинск',
  'Череповец',
  'Чита',
  'Элиста',
  'Южно-Сахалинск',
  'Якутск',
  'Ялта',
  'Ярославль',
] as const;

// The launch city — default selection for the Browse city filter and the form.
export const DEFAULT_CITY = 'Москва';

// Collapse common spellings/aliases to a canonical city so old/free-text values
// unify with the canonical name. Unknown values are returned trimmed as-is.
export function normalizeCity(input: string | null | undefined): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  const key = s.toLowerCase().replace(/[.\-]/g, '').replace(/\s+/g, ' ').trim();
  if (['москва', 'мск', 'msk', 'moscow'].includes(key)) return 'Москва';
  if (
    [
      'санкт петербург',
      'санктпетербург',
      'спб',
      'питер',
      'петербург',
      'saint petersburg',
      'st petersburg',
      'spb',
    ].includes(key)
  ) {
    return 'Санкт-Петербург';
  }
  return s;
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

// Browse filters. Location is driven by the city selector + free-text search
// (district / metro / street) — there is no postal-code filter in the RU market.
export type BrowseFilters = {
  rentMin: string;
  rentMax: string;
  bathrooms: string; // minimum bathrooms ('', '1', '2', '3')
  moveInBy: string;
  laundry: boolean;
  petsOk: boolean;
  elevator: boolean;
  walkUp: boolean;
  doorman: boolean;
  outdoor: boolean;
  allowNonRf: boolean;
  allowChildren: boolean;
};

export const EMPTY_FILTERS: BrowseFilters = {
  rentMin: '',
  rentMax: '',
  bathrooms: '',
  moveInBy: '',
  laundry: false,
  petsOk: false,
  elevator: false,
  walkUp: false,
  doorman: false,
  outdoor: false,
  allowNonRf: false,
  allowChildren: false,
};

export function hasActiveFilters(filters: BrowseFilters): boolean {
  return Object.entries(filters).some(([key, value]) =>
    typeof value === 'boolean' ? value : value.trim() !== ''
  );
}
