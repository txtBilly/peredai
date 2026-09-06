// Whether payments run in mock mode (preview/dev): no real processor is
// configured, so purchases complete instantly instead of going through YooKassa.
// Active when PAYMENTS_PROVIDER=mock, or when YooKassa credentials are absent or
// still the placeholder. Single source of truth used by the checkout routes and
// the pay screen so they always agree.
export function paymentsAreMock(): boolean {
  return (
    process.env.PAYMENTS_PROVIDER === 'mock' ||
    !process.env.YOOKASSA_SHOP_ID ||
    process.env.YOOKASSA_SHOP_ID === 'test-shop-id'
  );
}
