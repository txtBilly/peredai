import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCoupon, priceForCoupon, couponLabel, normalizeCouponCode } from '@/lib/coupons';

// Preview a coupon for the current user before checkout. Validates the code and
// returns the discounted price + token count so the pay screen can update. This
// is a PREVIEW only — the price/tokens are recomputed and re-validated server-
// side at commit (checkout/confirm) and never trusted from the client.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { code?: unknown; locale?: unknown };
  const code = normalizeCouponCode(typeof body.code === 'string' ? body.code : '');
  const locale: 'ru' | 'en' = body.locale === 'en' ? 'en' : 'ru';
  if (!code) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 200 });

  const result = await validateCoupon(code, user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 200 });
  }

  const pricing = priceForCoupon(result.coupon);
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
