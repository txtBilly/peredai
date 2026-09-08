// Which payment provider is active. Single source of truth for the checkout
// routes and the pay screen so they always agree.
//
//   PAYMENTS_PROVIDER=mock     → purchases complete instantly (dev/preview)
//   PAYMENTS_PROVIDER=tochka   → Tochka SBP dynamic QR
//   PAYMENTS_PROVIDER=yookassa → YooKassa redirect (legacy)
//
// If PAYMENTS_PROVIDER is unset, we fall back to YooKassa when its credentials
// are configured, otherwise mock — so a fresh/preview environment is never
// accidentally charging.
export type PaymentProvider = 'mock' | 'tochka' | 'yookassa';

export function paymentProvider(): PaymentProvider {
  const p = process.env.PAYMENTS_PROVIDER;
  if (p === 'mock') return 'mock';
  if (p === 'tochka') return 'tochka';
  if (p === 'yookassa') return 'yookassa';
  const shopId = process.env.YOOKASSA_SHOP_ID;
  if (shopId && shopId !== 'test-shop-id') return 'yookassa';
  return 'mock';
}

export function paymentsAreMock(): boolean {
  return paymentProvider() === 'mock';
}
