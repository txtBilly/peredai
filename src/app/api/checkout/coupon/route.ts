import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCoupon, priceForCoupon, couponLabel, normalizeCouponCode } from '@/lib/coupons';
import { TOKEN_PRICE_RUB, MAX_TOKENS_PER_PURCHASE } from '@/lib/yookassa';

function parseQuantity(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_TOKENS_PER_PURCHASE);
}

// Preview a coupon for the current user before checkout. Validates the code and
// returns the discounted price + token count so the pay screen can update. This
// is a PREVIEW only — the price/tokens are recomputed and re-validated server-
// side at commit (checkout/confirm) and never trusted from the client.
export async function POST(req: NextRequest) {
  // Model A: an anonymous seeker can be on /pay before their account exists.
  // A preview is allowed either way; validateCoupon(…, null) skips the per-account
  // "already used" check, which is re-enforced at commit once the account exists.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = (await req.json().catch(() => ({}))) as {
    code?: unknown;
    locale?: unknown;
    quantity?: unknown;
  };
  const code = normalizeCouponCode(typeof body.code === 'string' ? body.code : '');
  const locale: 'ru' | 'en' = body.locale === 'en' ? 'en' : 'ru';
  const quantity = parseQuantity(body.quantity);
  if (!code) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 200 });

  const result = await validateCoupon(code, user?.id ?? null);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 200 });
  }

  const pricing = priceForCoupon(result.coupon, TOKEN_PRICE_RUB * quantity, quantity);
  return NextResponse.json({
    ok: true,
    code: result.coupon.code,
    label: couponLabel(result.coupon, pricing, locale),
    basePriceRub: pricing.basePriceRub,
    finalPriceRub: pricing.finalPriceRub,
    discountRub: pricing.discountRub,
    baseCredits: pricing.baseCredits,
    totalCredits: pricing.totalCredits,
    free: pricing.free,
  });
}
