// Single source of truth for the standard copy Ten2Ten attaches to every chat:
//   1. seekerGreeting()      — the automatic first message posted on the seeker's
//                              behalf when they open a new chat (so the lister
//                              never sees an empty conversation).
//   2. chatReminderBullets() — the "Памятка от Ten2Ten" shown at the top of every
//                              thread (role-aware safety guidance).
// All copy is Russian (RU market). Keep it generic and friendly — it's a starter,
// the parties take the conversation from here.

import { getDictionary } from '@/i18n/config';
import { listingTypeLabel } from '@/lib/listings';

// A short human label for the listing, e.g. "2-комн. в районе Хамовники".
// Returns null when we have nothing specific to say about it.
export function chatListingLabel(neighborhood?: string | null, type?: string | null): string | null {
  const l = getDictionary('ru').listing;
  const parts = [
    type ? listingTypeLabel(type, l) : null,
    neighborhood ? `в районе ${neighborhood}` : null,
  ].filter((p): p is string => !!p);
  return parts.length ? parts.join(' ') : null;
}

// Automatic opening message from the seeker → lister. Generic: greeting, the
// seeker's name, interest in the listing, and a nudge to move things forward.
export function seekerGreeting(name?: string | null, listingLabel?: string | null): string {
  const intro = name && name.trim() ? ` Меня зовут ${name.trim()}.` : '';
  const about = listingLabel ? ` — ${listingLabel}` : '';
  return `Здравствуйте!${intro} Заинтересовало ваше объявление${about}. Подскажите, пожалуйста, квартира ещё доступна? Хочу узнать подробности и договориться о просмотре.`;
}

// The pinned reminder shown at the start of every chat. First three points are
// shared; the rest depend on whether you're renting (seeker) or handing over
// (lister).
export function chatReminderBullets(role: 'seeker' | 'lister'): string[] {
  const shared = [
    'Ведите общение внутри Ten2Ten.',
    'Не передавайте конфиденциальные финансовые данные и встречайтесь в безопасном общественном месте.',
    'При личной встрече попросите показать документ, удостоверяющий личность.',
  ];
  const seeker = [
    'Уточните, обсуждается ли размер благодарности.',
    'Не платите заранее и просите расписку за любые переданные деньги.',
  ];
  const lister = [
    'Согласуйте с собственником, что кандидат соответствует требованиям.',
    'Не берите предоплату, пока не убедитесь, что арендатор подходит, и до обсуждения важных деталей.',
    'Честно и по возможности полно раскрывайте важные детали о квартире.',
  ];
  return [...shared, ...(role === 'seeker' ? seeker : lister)];
}
