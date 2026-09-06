// Discount coupons for the contact-token purchase. All access is via the
// service-role admin client (the coupons tables are RLS-locked to server-only).
//
// A coupon can discount the price, grant extra tokens, or both; a 'free' coupon
// is 100% off and grants the bundle with no payment. Pricing is ALWAYS computed
// here on the server — the client only previews it. One redemption per account
// is enforced by the unique (coupon_id, user_id) constraint plus the check below.

import { createAdminClient } from './supabase/server';
import { CONTACT_BUNDLE_PRICE_RUB } from './yookassa';
import { CREDITS_PER_PURCHASE } from './credits';

export type Coupon = {
  id: string;
  code: string;
  kind: 'percent' | 'fixed' | 'free';
  value: number;
  bonus_credits: number;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
};

export type CouponReason =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'max_reached'
  | 'already_used';

export type CouponPricing = {
  basePriceRub: number;
  finalPriceRub: number;
  discountRub: number;
  baseCredits: number;
  totalCredits: number;
  free: boolean;
};

export function normalizeCouponCode(input: string | null | undefined): string {
  return (input ?? '').trim().toUpperCase();
}

// Load a coupon by code and check it's usable by this user right now.
export async function validateCoupon(
  rawCode: string,
  userId: string
): Promise<{ ok: true; coupon: Coupon } | { ok: false; reason: CouponReason }> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, reason: 'not_found' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('coupons')
    .select('id, code, kind, value, bonus_credits, active, starts_at, expires_at, max_redemptions, redeemed_count')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) return { ok: false, reason: 'not_found' };
  const coupon = data as Coupon;

  if (!coupon.active) return { ok: false, reason: 'inactive' };
  const now = Date.now();
  if (coupon.starts_at && now < new Date(coupon.starts_at).getTime()) {
    return { ok: false, reason: 'not_started' };
  }
  if (coupon.expires_at && now > new Date(coupon.expires_at).getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (coupon.max_redemptions != null && coupon.redeemed_count >= coupon.max_redemptions) {
    return { ok: false, reason: 'max_reached' };
  }

  // One redemption per account.
  const { data: prior } = await admin
    .from('coupon_redemptions')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (prior) return { ok: false, reason: 'already_used' };

  return { ok: true, coupon };
}

// Compute the final price and token count for a coupon. Server-authoritative.
export function priceForCoupon(
  coupon: Coupon,
  basePriceRub: number = CONTACT_BUNDLE_PRICE_RUB,
  baseCredits: number = CREDITS_PER_PURCHASE
): CouponPricing {
  let discountRub = 0;
  if (coupon.kind === 'free') {
    discountRub = basePriceRub;
  } else if (coupon.kind === 'percent') {
    discountRub = Math.round((basePriceRub * coupon.value) / 100);
  } else if (coupon.kind === 'fixed') {
    discountRub = Math.min(coupon.value, basePriceRub);
  }
  discountRub = Math.max(0, Math.min(discountRub, basePriceRub));
  const finalPriceRub = basePriceRub - discountRub;
  const totalCredits = baseCredits + Math.max(0, coupon.bonus_credits);
  return {
    basePriceRub,
    finalPriceRub,
    discountRub,
    baseCredits,
    totalCredits,
    free: finalPriceRub === 0,
  };
}

// Record a redemption (idempotent per user via the unique constraint) and bump
// the coupon's redeemed_count. Returns false if this account already redeemed it.
export async function recordRedemption(params: {
  couponId: string;
  userId: string;
  amountDiscounted: number;
  creditsGranted: number;
  paymentRef: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from('coupon_redemptions').insert({
    coupon_id: params.couponId,
    user_id: params.userId,
    amount_discounted: params.amountDiscounted,
    credits_granted: params.creditsGranted,
    payment_ref: params.paymentRef,
  });
  if (error) {
    if (error.code === '23505') return false; // already redeemed by this user
    throw error;
  }
  // Best-effort counter bump (the redemptions table is the source of truth).
  const { data: cur } = await admin
    .from('coupons')
    .select('redeemed_count')
    .eq('id', params.couponId)
    .maybeSingle();
  await admin
    .from('coupons')
    .update({ redeemed_count: (cur?.redeemed_count ?? 0) + 1 })
    .eq('id', params.couponId);
  return true;
}

// Short human label describing the coupon effect, for the pay screen.
export function couponLabel(coupon: Coupon, pricing: CouponPricing, locale: 'ru' | 'en'): string {
  const parts: string[] = [];
  if (coupon.kind === 'free') {
    parts.push(locale === 'en' ? 'Free' : 'Бесплатно');
  } else if (pricing.discountRub > 0) {
    parts.push(
      coupon.kind === 'percent'
        ? `−${coupon.value}%`
        : locale === 'en'
          ? `−${pricing.discountRub} ₽`
          : `−${pricing.discountRub} ₽`
    );
  }
  if (coupon.bonus_credits > 0) {
    parts.push(locale === 'en' ? `+${coupon.bonus_credits} tokens` : `+${coupon.bonus_credits} токена`);
  }
  return parts.join(' · ') || (locale === 'en' ? 'Applied' : 'Применён');
}
