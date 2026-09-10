import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/adminAuth';
import { createPaymentWithReceipt } from '@/lib/tochka';

export const runtime = 'nodejs';

// Staff-only: create ONE real (unpaid) acquiring payment-with-receipt to verify
// internet acquiring + the JWT's MakeAcquiringOperation scope + customerCode all
// work, and to see the returned paymentLink. Creating a link moves no money. The
// full response (or error) is written to tochka_webhook_log so it shows on the
// /admin/tochka panel. If staff pays the link, the test check goes to their email.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const staff = await requireStaff();
  if (!staff) return NextResponse.redirect(`${origin}/admin/login`, 303);

  const res = await createPaymentWithReceipt({
    amountRub: 10,
    purpose: 'Тест интеграции Ten2Ten. Без НДС',
    clientEmail: staff.email ?? 'test@ten2ten.ru',
    itemName: 'Токены Ten2Ten (тест)',
    redirectUrl: `${origin}/admin/tochka`,
    ttlMinutes: 60,
  });

  const admin = createAdminClient();
  await admin
    .from('tochka_webhook_log')
    .insert({
      content_type: 'admin-action',
      body: JSON.stringify(res, null, 2),
      action: res.ok ? `acquiring_test:ok status=${res.payment.status}` : `acquiring_test:err ${res.error}`,
    })
    .then(
      () => undefined,
      (e) => console.error('[acquiring-test] log insert failed', e)
    );

  return NextResponse.redirect(`${origin}/admin/tochka?wh=acquiring_${res.ok ? 'ok' : 'err'}`, 303);
}
