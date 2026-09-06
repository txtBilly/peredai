'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import type { Locale } from '@/i18n/config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  ru: {
    tag: 'Оплата через СБП',
    title: 'Доступ к откликам',
    // {price} = price per single token (formatted by the caller).
    explainer:
      'Каждый токен открывает один отклик на объявление — {price} ₽ за токен. Выберите, сколько токенов купить.',
    quantityLabel: 'Количество токенов',
    decrease: 'Меньше',
    increase: 'Больше',
    scan: 'Отсканируйте QR-код в приложении вашего банка и подтвердите оплату по Системе быстрых платежей.',
    mock: 'Тестовый режим — реальная оплата не производится. Отсканируйте QR-код и нажмите «Я оплатил», чтобы продолжить.',
    paid: 'Я оплатил',
    pay: 'Оплатить',
    activate: 'Активировать',
    cancel: 'Отмена',
    rub: '₽',
    haveCoupon: 'Есть промокод?',
    couponPlaceholder: 'Промокод',
    applyCoupon: 'Применить',
    applying: 'Проверяем…',
    removeCoupon: 'Убрать',
    total: 'Итого',
    emailLabel: 'Электронная почта',
    emailPlaceholder: 'you@example.com',
    consentPrefix: 'Я принимаю ',
    consentTerms: 'условия использования',
    consentMid: ' и ',
    consentPrivacy: 'политику конфиденциальности',
    consentSuffix: '.',
    consentPdPrefix: 'Я даю ',
    consentPdLabel: 'согласие на обработку персональных данных',
    consentPdSuffix: '.',
    formErrors: {
      invalid_email: 'Введите корректный email.',
      consent_required: 'Необходимо принять условия и политику.',
      consent_pd_required: 'Необходимо согласие на обработку персональных данных.',
      signup_failed: 'Не удалось создать аккаунт. Попробуйте ещё раз.',
    } as Record<string, string>,
    couponErrors: {
      not_found: 'Промокод не найден.',
      inactive: 'Промокод неактивен.',
      not_started: 'Промокод ещё не действует.',
      expired: 'Срок действия промокода истёк.',
      max_reached: 'Промокод больше недоступен.',
      already_used: 'Вы уже использовали этот промокод.',
      generic: 'Не удалось применить промокод.',
    } as Record<string, string>,
  },
  en: {
    tag: 'Pay via SBP',
    title: 'Access to listings',
    explainer:
      'Each token opens one response to a listing — {price} ₽ per token. Choose how many tokens to buy.',
    quantityLabel: 'Number of tokens',
    decrease: 'Decrease',
    increase: 'Increase',
    scan: 'Scan the QR code in your bank app and confirm the payment via the Faster Payments System (SBP).',
    mock: 'Test mode — no real payment is taken. Scan the QR code and tap “I’ve paid” to continue.',
    paid: "I've paid",
    pay: 'Pay',
    activate: 'Activate',
    cancel: 'Cancel',
    rub: '₽',
    haveCoupon: 'Have a promo code?',
    couponPlaceholder: 'Promo code',
    applyCoupon: 'Apply',
    applying: 'Checking…',
    removeCoupon: 'Remove',
    total: 'Total',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    consentPrefix: 'I accept the ',
    consentTerms: 'Terms',
    consentMid: ' and ',
    consentPrivacy: 'Privacy Policy',
    consentSuffix: '.',
    consentPdPrefix: 'I give my ',
    consentPdLabel: 'consent to the processing of personal data',
    consentPdSuffix: '.',
    formErrors: {
      invalid_email: 'Enter a valid email.',
      consent_required: 'You must accept the terms and policy.',
      consent_pd_required: 'Consent to personal-data processing is required.',
      signup_failed: 'Couldn’t create your account. Please try again.',
    } as Record<string, string>,
    couponErrors: {
      not_found: 'Promo code not found.',
      inactive: 'This promo code is inactive.',
      not_started: 'This promo code isn’t active yet.',
      expired: 'This promo code has expired.',
      max_reached: 'This promo code is no longer available.',
      already_used: 'You’ve already used this promo code.',
      generic: 'Couldn’t apply the promo code.',
    } as Record<string, string>,
  },
} as const;

// Grammatical plural for "token" in each locale.
function tokensWord(n: number, locale: Locale): string {
  if (locale === 'en') return n === 1 ? 'token' : 'tokens';
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'токен';
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return 'токена';
  return 'токенов';
}

type Applied = {
  code: string;
  label: string;
  finalPriceRub: number;
  discountRub: number;
  totalCredits: number;
  free: boolean;
};

export default function PayView({
  locale,
  listingId,
  unitPriceRub,
  maxQuantity,
  mock,
  loggedIn,
}: {
  locale: Locale;
  listingId: string | null;
  unitPriceRub: number;
  maxQuantity: number;
  mock: boolean;
  loggedIn: boolean;
}) {
  const c = COPY[locale] ?? COPY.ru;
  const nf = locale === 'en' ? 'en-US' : 'ru-RU';

  const [quantity, setQuantity] = useState(1);
  const [couponInput, setCouponInput] = useState('');
  const [applied, setApplied] = useState<Applied | null>(null);
  const [applying, setApplying] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [formError, setFormError] = useState('');

  // Controlled so the mock QR can be revealed only once they're filled in.
  const [email, setEmail] = useState('');
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPd, setConsentPd] = useState(false);

  // Surface errors passed back from the commit route (?coupon_error / ?form_error).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cErr = params.get('coupon_error');
    if (cErr) setCouponError(c.couponErrors[cErr] ?? c.couponErrors.generic);
    const fErr = params.get('form_error');
    if (fErr) setFormError(c.formErrors[fErr] ?? c.formErrors.signup_failed);
  }, [c]);

  const baseTotal = unitPriceRub * quantity;
  const price = applied ? applied.finalPriceRub : baseTotal;
  const totalCredits = applied ? applied.totalCredits : quantity;
  const free = applied?.free ?? false;
  const discounted = !!applied && applied.discountRub > 0;

  // A coupon's discount/tokens depend on the quantity, so re-preview whenever the
  // quantity changes while a coupon is applied. Depend only on [quantity] to avoid
  // re-firing on the setApplied this triggers.
  useEffect(() => {
    if (!applied) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/checkout/coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: applied.code, locale, quantity }),
        });
        const data = (await res.json().catch(() => ({}))) as
          | { ok: true; code: string; label: string; finalPriceRub: number; discountRub: number; totalCredits: number; free: boolean }
          | { ok: false; error: string };
        if (cancelled) return;
        if (data.ok) {
          setApplied({
            code: data.code,
            label: data.label,
            finalPriceRub: data.finalPriceRub,
            discountRub: data.discountRub,
            totalCredits: data.totalCredits,
            free: data.free,
          });
        }
      } catch {
        /* keep the last-known pricing on a transient error */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity]);

  // Mock NSPK-style SBP payload — regenerated whenever the amount changes.
  const qrPayload = `https://qr.nspk.ru/MOCKPEREDAI?sum=${price * 100}&cur=RUB&crc=MOCK`;
  // Reveal the (mock) QR only after email + all consents are provided — mirroring
  // production, where YooKassa issues the real QR only after the email is captured.
  const formReady = loggedIn || (EMAIL_RE.test(email) && consentTerms && consentPd);
  const showQr = mock && !free && formReady;

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || applying) return;
    setApplying(true);
    setCouponError('');
    try {
      const res = await fetch('/api/checkout/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, locale, quantity }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { ok: true; code: string; label: string; finalPriceRub: number; discountRub: number; totalCredits: number; free: boolean }
        | { ok: false; error: string };
      if (!data.ok) {
        setApplied(null);
        setCouponError(c.couponErrors[data.error] ?? c.couponErrors.generic);
      } else {
        setApplied({
          code: data.code,
          label: data.label,
          finalPriceRub: data.finalPriceRub,
          discountRub: data.discountRub,
          totalCredits: data.totalCredits,
          free: data.free,
        });
      }
    } catch {
      setCouponError(c.couponErrors.generic);
    }
    setApplying(false);
  }

  function removeCoupon() {
    setApplied(null);
    setCouponInput('');
    setCouponError('');
  }

  const btnLabel = free ? c.activate : mock ? c.paid : c.pay;
  const fieldClass =
    'flex-1 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt';
  const stepBtn =
    'flex h-10 w-10 items-center justify-center rounded-lg border border-black/15 text-xl leading-none text-ink transition hover:border-black/40 hover:bg-black/[0.03] disabled:opacity-40';

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
      <h1 className="mb-1 font-display text-2xl text-ink">{c.title}</h1>
      <p className="mb-4 text-sm text-muted">{c.tag}</p>
      <p className="mb-6 text-sm text-ink">
        {c.explainer.replace('{price}', unitPriceRub.toLocaleString(nf))}
      </p>

      {/* Quantity */}
      <div className="mb-4">
        <p className="mb-1.5 text-sm text-muted">{c.quantityLabel}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={c.decrease}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className={stepBtn}
          >
            −
          </button>
          <span className="min-w-8 text-center font-display text-xl text-ink">{quantity}</span>
          <button
            type="button"
            aria-label={c.increase}
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            disabled={quantity >= maxQuantity}
            className={stepBtn}
          >
            +
          </button>
          <span className="ml-1 text-sm text-muted">
            {unitPriceRub.toLocaleString(nf)} {c.rub} × {quantity}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="flex flex-col items-center rounded-xl border border-black/10 bg-white p-6">
        <div className="flex items-baseline gap-2">
          {discounted && (
            <span className="font-display text-lg text-muted line-through">
              {baseTotal.toLocaleString(nf)} {c.rub}
            </span>
          )}
          <span className="font-display text-3xl text-ink">
            {free ? (locale === 'en' ? 'Free' : 'Бесплатно') : `${price.toLocaleString(nf)} ${c.rub}`}
          </span>
        </div>
        {applied && (
          <p className="mt-2 text-sm font-medium text-cobalt">
            {applied.code} · {applied.label}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          {c.total}: {totalCredits} {tokensWord(totalCredits, locale)}
        </p>
      </div>

      {/* Coupon */}
      <div className="mt-4">
        {applied ? (
          <div className="flex items-center justify-between rounded-lg border border-cobalt/30 bg-cobalt/5 px-3 py-2 text-sm">
            <span className="font-medium text-ink">{applied.code}</span>
            <button type="button" onClick={removeCoupon} className="text-muted underline-offset-2 hover:text-ink hover:underline">
              {c.removeCoupon}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="coupon" className="text-sm text-muted">
              {c.haveCoupon}
            </label>
            <div className="flex gap-2">
              <input
                id="coupon"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCoupon();
                  }
                }}
                placeholder={c.couponPlaceholder}
                autoComplete="off"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={applying || !couponInput.trim()}
                className="rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-black/40 hover:bg-black/[0.03] disabled:opacity-50"
              >
                {applying ? c.applying : c.applyCoupon}
              </button>
            </div>
          </div>
        )}
        {couponError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {couponError}
          </p>
        )}
      </div>

      <form action="/api/checkout/confirm" method="POST" className="mt-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="quantity" value={quantity} />
        {listingId && <input type="hidden" name="listing_id" value={listingId} />}
        {applied && <input type="hidden" name="coupon" value={applied.code} />}

        {/* Anonymous seeker: capture email + consents right here (account is created
            at payment). Signed-in users skip this. */}
        {!loggedIn && (
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pay-email" className="text-sm text-muted">
                {c.emailLabel}
              </label>
              <input
                id="pay-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPlaceholder}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
              />
            </div>
            <label className="flex items-start gap-2.5 text-sm text-muted">
              <input
                type="checkbox"
                name="consent"
                required
                checked={consentTerms}
                onChange={(e) => setConsentTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/30 bg-white accent-cobalt"
              />
              <span>
                {c.consentPrefix}
                <Link href={`/${locale}/terms`} className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80">
                  {c.consentTerms}
                </Link>
                {c.consentMid}
                <Link href={`/${locale}/privacy`} className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80">
                  {c.consentPrivacy}
                </Link>
                {c.consentSuffix}
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm text-muted">
              <input
                type="checkbox"
                name="consent_pd"
                required
                checked={consentPd}
                onChange={(e) => setConsentPd(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/30 bg-white accent-cobalt"
              />
              <span>
                {c.consentPdPrefix}
                <Link href={`/${locale}/personal-data-consent`} className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80">
                  {c.consentPdLabel}
                </Link>
                {c.consentPdSuffix}
              </span>
            </label>
            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}
          </div>
        )}

        {/* QR — mock only, revealed after email + consents so the test flow matches
            production (real QR is issued by YooKassa after the email is captured). */}
        {showQr && (
          <div className="mb-4 flex flex-col items-center rounded-xl border border-black/10 bg-white p-6">
            <div className="rounded-lg bg-white p-3 ring-1 ring-black/10">
              <QRCodeSVG value={qrPayload} size={200} level="M" />
            </div>
            <p className="mt-4 text-center text-sm text-muted">{c.scan}</p>
            <div className="mt-4 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {c.mock}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-semibold text-white transition hover:brightness-110"
        >
          {btnLabel}
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
