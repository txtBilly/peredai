import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { CONTACT_BUNDLE_PRICE_RUB } from '@/lib/yookassa';
import { CREDITS_PER_PURCHASE } from '@/lib/credits';
import PayView from './PayView';

// Mock SBP-QR checkout page. In preview/dev the /api/checkout route redirects
// here instead of granting credits silently, so the SBP payment UX can be
// tested end to end. The real SBP integration later renders the QR from
// YooKassa's confirmation_data on this same screen.
export default async function PayPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { listing_id?: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  await requireUser(locale);
  const listingId =
    typeof searchParams.listing_id === 'string' && searchParams.listing_id
      ? searchParams.listing_id
      : null;

  return (
    <PayView
      locale={locale}
      listingId={listingId}
      priceRub={CONTACT_BUNDLE_PRICE_RUB}
      credits={CREDITS_PER_PURCHASE}
    />
  );
}
