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
  'Альметьевск',
  'Анадырь',
  'Ангарск',
  'Арзамас',
  'Армавир',
  'Артём',
  'Архангельск',
  'Астрахань',
  'Ачинск',
  'Балаково',
  'Балашиха',
  'Барнаул',
  'Батайск',
  'Белгород',
  'Бердск',
  'Березники',
  'Бийск',
  'Биробиджан',
  'Благовещенск',
  'Братск',
  'Брянск',
  'Великий Новгород',
  'Владивосток',
  'Владикавказ',
  'Владимир',
  'Волгоград',
  'Волгодонск',
  'Волжский',
  'Вологда',
  'Воронеж',
  'Горно-Алтайск',
  'Грозный',
  'Дербент',
  'Джанкой',
  'Дзержинск',
  'Домодедово',
  'Евпатория',
  'Екатеринбург',
  'Елец',
  'Ессентуки',
  'Жуковский',
  'Златоуст',
  'Иваново',
  'Ижевск',
  'Иркутск',
  'Йошкар-Ола',
  'Казань',
  'Калининград',
  'Калуга',
  'Каменск-Уральский',
  'Камышин',
  'Каспийск',
  'Кемерово',
  'Керчь',
  'Киров',
  'Кисловодск',
  'Ковров',
  'Коломна',
  'Комсомольск-на-Амуре',
  'Копейск',
  'Королёв',
  'Кострома',
  'Красногорск',
  'Краснодар',
  'Красноярск',
  'Курган',
  'Курск',
  'Кызыл',
  'Липецк',
  'Люберцы',
  'Магадан',
  'Магас',
  'Магнитогорск',
  'Майкоп',
  'Махачкала',
  'Миасс',
  'Мурманск',
  'Муром',
  'Мытищи',
  'Набережные Челны',
  'Нальчик',
  'Находка',
  'Невинномысск',
  'Нефтекамск',
  'Нефтеюганск',
  'Нижневартовск',
  'Нижнекамск',
  'Нижний Новгород',
  'Нижний Тагил',
  'Новокузнецк',
  'Новокуйбышевск',
  'Новороссийск',
  'Новосибирск',
  'Новотроицк',
  'Новочеркасск',
  'Новошахтинск',
  'Новый Уренгой',
  'Ногинск',
  'Норильск',
  'Ноябрьск',
  'Обнинск',
  'Одинцово',
  'Октябрьский',
  'Омск',
  'Орёл',
  'Оренбург',
  'Орехово-Зуево',
  'Орск',
  'Пенза',
  'Первоуральск',
  'Пермь',
  'Петрозаводск',
  'Подольск',
  'Прокопьевск',
  'Псков',
  'Пушкино',
  'Пятигорск',
  'Раменское',
  'Реутов',
  'Ростов-на-Дону',
  'Рубцовск',
  'Рыбинск',
  'Рязань',
  'Салават',
  'Салехард',
  'Самара',
  'Саранск',
  'Саратов',
  'Севастополь',
  'Северодвинск',
  'Северск',
  'Сергиев Посад',
  'Серпухов',
  'Симферополь',
  'Смоленск',
  'Сочи',
  'Ставрополь',
  'Старый Оскол',
  'Стерлитамак',
  'Сургут',
  'Сызрань',
  'Сыктывкар',
  'Таганрог',
  'Тамбов',
  'Тверь',
  'Тобольск',
  'Тольятти',
  'Томск',
  'Тула',
  'Тюмень',
  'Улан-Удэ',
  'Ульяновск',
  'Уссурийск',
  'Уфа',
  'Феодосия',
  'Хабаровск',
  'Ханты-Мансийск',
  'Химки',
  'Чебоксары',
  'Челябинск',
  'Череповец',
  'Чита',
  'Шахты',
  'Щёлково',
  'Электросталь',
  'Элиста',
  'Энгельс',
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
  languages: string[]; // filter to listers who speak at least one of these
};

// Russian is the platform's baseline language: it's locked on in the signup
// language picker and pre-selected (non-removable) in the Browse filter, so the
// empty-filter state already includes it.
export const BASELINE_LANGUAGE = 'ru';

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
  languages: [BASELINE_LANGUAGE],
};

export function hasActiveFilters(filters: BrowseFilters): boolean {
  return Object.entries(filters).some(([key, value]) => {
    // The baseline language ('ru') is always selected, so it doesn't count as an
    // active filter — only additional languages do.
    if (key === 'languages') return Array.isArray(value) && value.some((v) => v !== BASELINE_LANGUAGE);
    return Array.isArray(value) ? value.length > 0 : typeof value === 'boolean' ? value : value.trim() !== '';
  });
}

// Languages offered in the "spoken languages" pickers (signup + browse filter).
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'uz', label: 'Oʻzbekcha' },
  { value: 'tg', label: 'Тоҷикӣ' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'pt', label: 'Português' },
  { value: 'ko', label: '한국어' },
];
