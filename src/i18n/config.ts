export const locales = ['ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

import ru from './ru.json';
import en from './en.json';

const dictionaries = { ru, en } as const;

// The Russian dictionary is canonical for the market; English is a fallback that
// mirrors its shape exactly.
export type Dictionary = typeof ru;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary;
}

/** Intl locale tag for date/number formatting. */
export function intlLocale(locale: Locale): string {
  return locale === 'en' ? 'en-US' : 'ru-RU';
}
