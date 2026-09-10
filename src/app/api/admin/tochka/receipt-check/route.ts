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

  // Pull the single operation object out of the response.
  const op =
    ((raw.json as { Data?: { Operation?: Array<Record<string, unknown>> } })?.Data?.Operation?.[0]) ??
    (raw.json as { Data?: Record<string, unknown> })?.Data ??
    null;

  // Build a SMALL, copyable receipt-focused summary. The question is: did Точка
  // fiscalize a check? That shows up as a receipt/OFD block (a receipt url or a
  // fiscal document number). We also confirm our own payload reached Точка intact
  // (Client.email + Items) so the check will fire once a касса is bound.
  const opKeys = op ? Object.keys(op) : [];
  const receiptKeyRe = /(receipt|ofd|fiscal|check|kkt|касс|чек|fn|fd|fp)/i;
  const receiptKeys = opKeys.filter((k) => receiptKeyRe.test(k));
  const receiptFields: Record<string, unknown> = {};
  for (const k of receiptKeys) receiptFields[k] = (op as Record<string, unknown>)[k];

  const client = (op as { Client?: unknown } | null)?.Client ?? null;
  const items = (op as { Items?: unknown[] } | null)?.Items ?? null;

  const summary = {
    operationStatus: status,
    amount: (op as { amount?: unknown } | null)?.amount ?? null,
    taxSystemCode: (op as { taxSystemCode?: unknown } | null)?.taxSystemCode ?? null,
    // Did we send the buyer's email + line items? (needed for a check)
    clientEchoed: client,
    itemsCount: Array.isArray(items) ? items.length : items === null ? 'MISSING' : 'present',
    firstItem: Array.isArray(items) ? items[0] ?? null : null,
    // The decisive bit: any receipt/OFD/fiscal fields present on the operation?
    receiptFieldsFound: receiptKeys.length ? receiptFields : 'NONE — no fiscal/OFD block on operation',
    allOperationKeys: opKeys,
  };

  await admin
    .from('tochka_webhook_log')
    .insert({
      content_type: 'admin-action',
      action: `receipt_check op=${intent.trx_id} status=${status} receipt=${
        receiptKeys.length ? 'present' : 'none'
      }`.slice(0, 200),
      parsed_qrc_id: intent.qrc_id ?? null,
      body: JSON.stringify(
        {
          intent: {
            operationId: intent.trx_id,
            credits: intent.credits,
            price_rub: intent.price_rub,
            status: intent.status,
          },
          summary,
        },
        null,
        2
      ).slice(0, 4000),
    })
    .then(
      () => undefined,
      (e) => console.error('[receipt-check] log insert failed', e)
    );

  return back('wh=receipt_checked');
}
