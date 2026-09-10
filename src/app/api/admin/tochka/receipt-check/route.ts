import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/adminAuth';
import { getAcquiringOperation } from '@/lib/tochka';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Staff-only: fetch the FULL Tochka operation detail for the most recent granted
// acquiring payment and write it to tochka_webhook_log, so we can see whether a
// fiscal receipt (чек) was actually issued/emailed. The raw response carries the
// fiscalization block when Точка Касса issued one; its absence means the payment
// cleared but no 54-ФЗ check was fiscalized (касса not connected/active).
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const staff = await requireStaff();
  if (!staff) return NextResponse.redirect(`${origin}/admin/login`, 303);
  const back = (q: string) => NextResponse.redirect(`${origin}/admin/tochka?${q}`, 303);

  const admin = createAdminClient();
  const { data: intent } = await admin
    .from('sbp_intents')
    .select('qrc_id, trx_id, credits, price_rub, status, created_at')
    .not('trx_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!intent?.trx_id) return back('wh=receipt_none');

  const { status, raw } = await getAcquiringOperation(intent.trx_id);

  await admin
    .from('tochka_webhook_log')
    .insert({
      content_type: 'admin-action',
      action: `receipt_check op=${intent.trx_id} status=${status}`.slice(0, 200),
      parsed_qrc_id: intent.qrc_id ?? null,
      body: JSON.stringify(
        {
          intent: {
            qrc_id: intent.qrc_id,
            operationId: intent.trx_id,
            credits: intent.credits,
            price_rub: intent.price_rub,
            status: intent.status,
            created_at: intent.created_at,
          },
          operationStatus: status,
          rawOperation: raw.json ?? raw.text ?? raw.error ?? null,
        },
        null,
        2
      ).slice(0, 8000),
    })
    .then(
      () => undefined,
      (e) => console.error('[receipt-check] log insert failed', e)
    );

  return back('wh=receipt_checked');
}
