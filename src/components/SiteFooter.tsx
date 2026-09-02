import Link from 'next/link';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

// Site-wide footer (dark, SEO-rich). Rendered from the locale layout so it sits
// on every user-facing page, desktop and mobile. The intro paragraph and the
// column links give search engines real, keyword-bearing text + internal links.
//
// Copy is kept inline (bilingual) rather than in the shared dictionaries — it's
// footer/SEO boilerplate that would otherwise bloat every dictionary consumer.
const T = {
  ru: {
    slogan: 'сам себе риелтор',
    seo:
      'Ten2Ten — площадка передачи аренды напрямую между жильцами, без риелторов и комиссии. ' +
      'Уходя со съёмной квартиры, вы передаёте её следующему арендатору и получаете благодарность; ' +
      'въезжающий снимает жильё без переплат посредникам. Проверка личности через Сбер ID и Т‑Банк, ' +
      'безопасные чаты и честные условия. Аренда квартир, комнат и студий в Москве и Санкт‑Петербурге.',
    colService: 'Сервис',
    colCities: 'Города',
    colLegal: 'Правовое',
    colRent: 'Аренда',
    service: [
      ['Поиск жилья', 'browse'],
      ['Разместить объявление', 'list'],
      ['Как это работает', 'welcome'],
      ['Безопасность', 'safety'],
    ],
    cities: [
      ['Аренда в Москве', 'browse'],
      ['Аренда в Санкт‑Петербурге', 'browse'],
      ['Снять комнату', 'browse'],
      ['Снять студию', 'browse'],
    ],
    legal: [
      ['Условия', 'terms'],
      ['Конфиденциальность', 'privacy'],
      ['Обработка перс. данных', 'personal-data-consent'],
      ['Проверка личности', 'identity-consent'],
    ],
    rent: [
      ['Снять квартиру в Москве', 'browse'],
      ['Комната без комиссии', 'browse'],
      ['Студия у метро', 'browse'],
      ['2‑комнатная в СПб', 'browse'],
    ],
    copyright: '© 2026 Ten2Ten · ten2ten.ru',
    verifyNote: 'Проверка через Сбер ID и Т‑Банк',
    supportLabel: 'Поддержка',
    legalEntity: 'ООО «Тен2Тен» · ИНН 9715532264 · КПП 771501001 · ОГРН 1267700290989',
  },
  en: {
    slogan: 'be your own realtor',
    seo:
      'Ten2Ten is a platform for handing a rental straight from one tenant to the next — no realtors, no ' +
      'commission. When you move out, you pass the flat to the next renter and receive a thank-you; the ' +
      'person moving in rents with no middleman markup. Identity verified via Sber ID and T‑Bank, safe ' +
      'chats and fair terms. Rent apartments, rooms and studios in Moscow and Saint Petersburg.',
    colService: 'Service',
    colCities: 'Cities',
    colLegal: 'Legal',
    colRent: 'Rent',
    service: [
      ['Find a home', 'browse'],
      ['Post a listing', 'list'],
      ['How it works', 'welcome'],
      ['Safety', 'safety'],
    ],
    cities: [
      ['Rent in Moscow', 'browse'],
      ['Rent in Saint Petersburg', 'browse'],
      ['Rent a room', 'browse'],
      ['Rent a studio', 'browse'],
    ],
    legal: [
      ['Terms', 'terms'],
      ['Privacy', 'privacy'],
      ['Data processing', 'personal-data-consent'],
      ['Identity check', 'identity-consent'],
    ],
    rent: [
      ['Rent a flat in Moscow', 'browse'],
      ['Room with no fee', 'browse'],
      ['Studio near the metro', 'browse'],
      ['2-room in St Petersburg', 'browse'],
    ],
    copyright: '© 2026 Ten2Ten · ten2ten.ru',
    verifyNote: 'Verified via Sber ID and T‑Bank',
    supportLabel: 'Support',
    legalEntity: 'ООО «Тен2Тен» · ИНН 9715532264 · КПП 771501001 · ОГРН 1267700290989',
  },
} as const;

function Wordmark() {
  return (
    <span className="font-display text-xl font-bold tracking-[0.02em] text-white">
      TEN<span className="text-[#C4B5FD]">2</span>TEN
    </span>
  );
}

function Column({
  title,
  links,
  locale,
}: {
  title: string;
  links: readonly (readonly [string, string])[];
  locale: Locale;
}) {
  return (
    <div>
      <h4 className="mb-3 text-[13px] font-bold uppercase tracking-[0.06em] text-white">{title}</h4>
      <ul className="space-y-2.5">
        {links.map(([label, route]) => (
          <li key={label}>
            <Link href={`/${locale}/${route}`} className="text-sm text-[#9aa3b2] transition-colors hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = T[locale] ?? T.ru;

  return (
    <footer className="mt-16 bg-[#0f1729] text-[#cbd2dc]">
      <div className="mx-auto max-w-6xl px-5 pb-8 pt-12">
        {/* Brand + SEO paragraph */}
        <div className="grid gap-8 border-b border-white/10 pb-8 sm:grid-cols-[0.9fr_2.1fr]">
          <div>
            <Link href={`/${locale}/browse`} aria-label={dict.brand.name} className="inline-flex flex-col">
              <Wordmark />
              <span className="mt-1 text-xs lowercase tracking-[0.06em] text-[#9aa3b2]">{t.slogan}</span>
            </Link>
          </div>
          <p className="text-[13.5px] leading-relaxed text-[#9aa3b2]">{t.seo}</p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 pt-8 sm:grid-cols-4">
          <Column title={t.colService} links={t.service} locale={locale} />
          <Column title={t.colCities} links={t.cities} locale={locale} />
          <Column title={t.colLegal} links={t.legal} locale={locale} />
          <Column title={t.colRent} links={t.rent} locale={locale} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-4 text-[13px] text-[#7d8794]">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <span>{t.copyright}</span>
            <a href="mailto:support@ten2ten.ru" className="transition-colors hover:text-white">
              {t.supportLabel}: support@ten2ten.ru
            </a>
            <span>{t.verifyNote}</span>
          </div>
          <div className="mt-2 border-t border-white/[0.06] pt-2 text-[12px] text-[#6b7280]">{t.legalEntity}</div>
        </div>
      </div>
    </footer>
  );
}
