// YooKassa (ЮKassa) payment integration — replaces Stripe for the Russian
// market. Flow mirrors the old Stripe Checkout redirect+webhook:
//   1. createContactPayment() creates a payment and returns confirmation_url.
//   2. The seeker is redirected there to pay.
//   3. YooKassa POSTs a `payment.succeeded` notification to /api/yookassa/webhook,
//      which re-fetches the payment to confirm and grants contact credits.
//
// Uses the plain REST API (https://yookassa.ru/developers/api) over fetch — no
// SDK dependency. Auth is HTTP Basic with shopId:secretKey.
//
// Env:
//   YOOKASSA_SHOP_ID       — shop identifier from the YooKassa dashboard
//   YOOKASSA_SECRET_KEY    — secret key (server-only)
//   CONTACT_BUNDLE_PRICE_RUB — price in whole rubles for 3 contact credits

import { randomUUID } from 'crypto';

const API_BASE = 'https://api.yookassa.ru/v3';

export const CONTACT_BUNDLE_PRICE_RUB = Number(
  process.env.CONTACT_BUNDLE_PRICE_RUB ?? 1490
); // ₽1490 => 3 contact credits

export type YooKassaPayment = {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
};

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) {
    throw new Error('YooKassa credentials missing (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY)');
  }
  return 'Basic ' + Buffer.from(`${shopId}:${secret}`).toString('base64');
}

function rubValue(rubles: number): string {
  return rubles.toFixed(2); // YooKassa expects "1490.00"
}

// Create a payment for a seeker buying the contact-credit bundle. Auto-capture
// (capture: true) — a single charge, no manual-capture hold (there is no paid
// background check in the RU market).
export async function createContactPayment(params: {
  seekerId: string;
  email: string;
  returnUrl: string;
}): Promise<{ id: string; confirmationUrl: string }> {
  const res = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Idempotence-Key': randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: { value: rubValue(CONTACT_BUNDLE_PRICE_RUB), currency: 'RUB' },
      capture: true,
      // Restrict to СБП (Faster Payments) only. YooKassa's confirmation page then
      // shows a QR to scan on desktop, or a bank list on mobile.
      payment_method_data: { type: 'sbp' },
      confirmation: { type: 'redirect', return_url: params.returnUrl },
      description: '3 токена на контакты — Peredai',
      // 54-ФЗ receipt: the customer + a single service line item. YooKassa emails
      // the fiscal receipt. VAT code 1 = "без НДС" (adjust for your tax mode).
      receipt: {
        customer: { email: params.email },
        items: [
          {
            description: '3 токена на контакты',
            quantity: '1.00',
            amount: { value: rubValue(CONTACT_BUNDLE_PRICE_RUB), currency: 'RUB' },
            vat_code: 1,
            payment_mode: 'full_payment',
            payment_subject: 'service',
          },
        ],
      },
      metadata: { seeker_id: params.seekerId, kind: 'contact_bundle' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YooKassa create payment failed: ${res.status} ${text}`);
  }
  const payment = (await res.json()) as YooKassaPayment;
  const url = payment.confirmation?.confirmation_url;
  if (!url) throw new Error('YooKassa payment created without a confirmation_url');
  return { id: payment.id, confirmationUrl: url };
}

// Re-fetch a payment by id to confirm its real status (webhook notifications are
// not signed, so we verify against the API before granting anything).
export async function getPayment(id: string): Promise<YooKassaPayment> {
  const res = await fetch(`${API_BASE}/payments/${id}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YooKassa get payment failed: ${res.status} ${text}`);
  }
  return (await res.json()) as YooKassaPayment;
}
