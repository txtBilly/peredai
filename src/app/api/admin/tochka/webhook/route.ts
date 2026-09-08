import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/adminAuth';
import { registerWebhook, sendTestWebhook } from '@/lib/tochka';

export const runtime = 'nodejs';

// Staff-only webhook management, driven by the buttons on /admin/tochka.
//   action=register → subscribe https://<host>/api/tochka/webhook to incomingSbpPayment
//   action=test     → ask Tochka to POST a test incomingSbpPayment to that URL
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const staff = await requireStaff();
  if (!staff) return NextResponse.redirect(`${origin}/admin/login`, 303);

  const form = await req.formData().catch(() => null);
  const action = String(form?.get('action') ?? '');
  const back = (q: string) => NextResponse.redirect(`${origin}/admin/tochka?${q}`, 303);

  if (action === 'register') {
    const r = await registerWebhook(`${origin}/api/tochka/webhook`, ['incomingSbpPayment']);
    return back(`wh=${r.ok ? 'registered' : `error_${r.status}`}`);
  }
  if (action === 'test') {
    const r = await sendTestWebhook('incomingSbpPayment');
    return back(`wh=${r.ok ? 'test_sent' : `error_${r.status}`}`);
  }
  return back('wh=unknown_action');
}
