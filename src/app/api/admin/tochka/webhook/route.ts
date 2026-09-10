import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/adminAuth';
import { upsertWebhook, sendTestWebhook } from '@/lib/tochka';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Staff-only webhook management, driven by the buttons on /admin/tochka.
//   action=register → subscribe https://<host>/api/tochka/webhook to
//                     incomingSbpPayment + acquiringInternetPayment
//   action=test     → ask Tochka to POST a test incomingSbpPayment to that URL
//
// The full Tochka API response for each action is written to tochka_webhook_log
// (action=webhook_register:ok/err, webhook_test:ok/err) so a non-2xx (e.g. the
// HTTP 400 on register) is inspectable on the panel's delivery log.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const staff = await requireStaff();
  if (!staff) return NextResponse.redirect(`${origin}/admin/login`, 303);

  const form = await req.formData().catch(() => null);
  const action = String(form?.get('action') ?? '');
  const back = (q: string) => NextResponse.redirect(`${origin}/admin/tochka?${q}`, 303);

  const logResult = async (
    logAction: string,
    r: { ok: boolean; status: number; error?: string; json?: unknown; text?: string }
  ) => {
    try {
      await createAdminClient()
        .from('tochka_webhook_log')
        .insert({
          content_type: 'application/json',
          headers: {},
          body: JSON.stringify(
            { status: r.status, error: r.error ?? null, json: r.json ?? null, text: r.text ?? null },
            null,
            2
          ).slice(0, 8000),
          parsed_qrc_id: null,
          action: `${logAction}:${r.ok ? 'ok' : 'err'} http=${r.status}`,
        });
    } catch (e) {
      console.error('[admin tochka webhook] log insert failed', e);
    }
  };

  if (action === 'register') {
    // Create the subscription, or (if one already exists with a different event
    // list) delete + re-create so both events are covered.
    const r = await upsertWebhook(`${origin}/api/tochka/webhook`, [
      'incomingSbpPayment',
      'acquiringInternetPayment',
    ]);
    await logResult(r.recreated ? 'webhook_register(recreated)' : 'webhook_register', r);
    return back(`wh=${r.ok ? 'registered' : `error_${r.status}`}`);
  }
  if (action === 'test') {
    const r = await sendTestWebhook('incomingSbpPayment');
    await logResult('webhook_test', r);
    return back(`wh=${r.ok ? 'test_sent' : `error_${r.status}`}`);
  }
  return back('wh=unknown_action');
}
