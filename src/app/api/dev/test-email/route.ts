import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/twilio';

// TEMPORARY diagnostic route — verifies the live email provider (RuSender SMTP)
// end to end. Guarded by EMAIL_TEST_TOKEN: returns 404 unless the ?token= query
// matches, so it stays inert in production unless you deliberately set the env
// var. Remove this route (and the env var) once email delivery is confirmed.
//
//   GET /api/dev/test-email?token=<EMAIL_TEST_TOKEN>&to=you@example.com
//
// Node runtime (not edge) because nodemailer needs Node's net/tls stack.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = process.env.EMAIL_TEST_TOKEN;
  const provided = req.nextUrl.searchParams.get('token');
  // No token configured, or mismatch → behave as if the route doesn't exist.
  if (!token || provided !== token) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const to = req.nextUrl.searchParams.get('to');
  if (!to) {
    return NextResponse.json({ error: 'missing_to' }, { status: 400 });
  }

  const provider = process.env.EMAIL_PROVIDER ?? '(auto)';
  try {
    await sendEmail({
      to,
      subject: 'Ten2Ten — тестовое письмо',
      html:
        '<p>Это тестовое письмо от Ten2Ten через RuSender.</p>' +
        '<p>Если вы его видите — доставка транзакционных писем работает.</p>',
    });
    return NextResponse.json({ ok: true, to, provider });
  } catch (e) {
    // The SMTP path throws on connection/auth/relay errors, so surface the
    // message to make misconfiguration obvious from the response.
    return NextResponse.json(
      { ok: false, to, provider, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
