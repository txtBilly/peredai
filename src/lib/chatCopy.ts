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

// Lead-in line shown under the reminder title, before the bullets.
export const chatReminderIntro = 'При общении помните об обычных мерах предосторожности:';

// The pinned reminder shown at the start of every chat — a full, self-contained
// list per role (no shared/role split on screen).
export function chatReminderBullets(role: 'seeker' | 'lister'): string[] {
  if (role === 'lister') {
    return [
      'Не передавайте конфиденциальные финансовые данные и встречайтесь в безопасном общественном месте.',
      'При личной встрече попросите показать документ, удостоверяющий личность.',
      'Не берите предоплату, пока не убедитесь, что договоренность с собственником достигнута.',
      'Честно и, по возможности, полно раскрывайте важные детали о квартире.',
      'Вы не сможете получать сообщения от других арендаторов, пока данный чат будет оставаться открытым. Соискатель также не сможет направлять запросы по другим объявлениям.',
      'Будьте вежливы и требуйте того же от собеседника.',
      'Пусть Вам сопутствует успех!',
    ];
  }
  return [
    'Не передавайте конфиденциальные финансовые данные, данные из Госуслуг или какие-либо пароли/коды из СМС. Ten2Ten никогда не запрашивает подобной информации (кроме первоначальной регистрации через Sber ID).',
    'Назначайте встречу в безопасном общественном месте.',
    'При личной встрече попросите показать документ, удостоверяющий личность.',
    'Не вносите плату до достижения договоренности с собственником.',
    'Требуйте расписку за переданные наличные деньги.',
    'При просмотре квартиры обсудите даты выезда и возможность оставить/купить мебель и бытовую технику, если есть такая необходимость.',
    'Собеседник НЕ сможет получать сообщения от других пользователей Ten2Ten, пока он общается с Вами. Это ваша эксклюзивная возможность.',
    'Собеседник не получает вознаграждения от Ten2Ten.',
    'Будьте вежливы и требуйте того же от собеседника.',
    'Пусть Вам сопутствует успех!',
  ];
}
