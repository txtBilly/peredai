import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { TOKEN_PRICE_RUB, MAX_TOKENS_PER_PURCHASE } from '@/lib/yookassa';
import { paymentsAreMock } from '@/lib/payments';
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
  const listingId =
    typeof searchParams.listing_id === 'string' && searchParams.listing_id
      ? searchParams.listing_id
      : null;

  // Model A: anonymous seekers can reach the pay screen — it collects email +
  // consent and creates the account at payment. A signed-in user skips those.
  const {
    data: { user },
  } = await createClient().auth.getUser();

  return (
    <PayView
      locale={locale}
      listingId={listingId}
      unitPriceRub={TOKEN_PRICE_RUB}
      maxQuantity={MAX_TOKENS_PER_PURCHASE}
      mock={paymentsAreMock()}
      loggedIn={!!user}
    />
  );
}
