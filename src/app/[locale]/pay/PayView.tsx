'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import type { Locale } from '@/i18n/config';

const COPY = {
  ru: {
    tag: 'Оплата через СБП',
    title: 'Оплатите {n} контакта',
    scan: 'Отсканируйте QR-код в приложении вашего банка и подтвердите оплату по Системе быстрых платежей.',
    mock: 'Тестовый режим — реальная оплата не производится. Нажмите «Я оплатил», чтобы продолжить.',
    paid: 'Я оплатил',
    cancel: 'Отмена',
    rub: '₽',
  },
  en: {
    tag: 'Pay via SBP',
    title: 'Pay for {n} contacts',
    scan: 'Scan the QR code in your bank app and confirm the payment via the Faster Payments System (SBP).',
    mock: 'Test mode — no real payment is taken. Tap “I’ve paid” to continue.',
    paid: "I've paid",
    cancel: 'Cancel',
    rub: '₽',
  },
} as const;

export default function PayView({
  locale,
  listingId,
  priceRub,
  credits,
}: {
  locale: Locale;
  listingId: string | null;
  priceRub: number;
  credits: number;
}) {
  const c = COPY[locale] ?? COPY.ru;
  // Mock NSPK-style SBP payload — just to render a realistic-looking QR.
  const qrPayload = `https://qr.nspk.ru/MOCKPEREDAI?sum=${priceRub * 100}&cur=RUB&crc=MOCK`;
  const nf = locale === 'en' ? 'en-US' : 'ru-RU';

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
      <h1 className="mb-1 font-display text-2xl text-ink">
        {c.title.replace('{n}', String(credits))}
      </h1>
      <p className="mb-6 text-sm text-muted">{c.tag}</p>

      <div className="flex flex-col items-center rounded-xl border border-black/10 bg-white p-6">
        <div className="rounded-lg bg-white p-3 ring-1 ring-black/10">
          <QRCodeSVG value={qrPayload} size={200} level="M" />
        </div>
        <p className="mt-4 font-display text-3xl text-ink">
          {priceRub.toLocaleString(nf)} {c.rub}
        </p>
      </div>

      <p className="mt-4 text-sm text-muted">{c.scan}</p>

      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        {c.mock}
      </div>

      <form action="/api/checkout/confirm" method="POST" className="mt-6">
        <input type="hidden" name="locale" value={locale} />
        {listingId && <input type="hidden" name="listing_id" value={listingId} />}
        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-semibold text-white transition hover:brightness-110"
        >
          {c.paid}
        </button>
      </form>

      <div className="mt-3 text-center">
        <Link
          href={listingId ? `/${locale}/browse/${listingId}` : `/${locale}/browse`}
          className="text-sm text-muted hover:text-ink"
        >
          {c.cancel}
        </Link>
      </div>
    </main>
  );
}
