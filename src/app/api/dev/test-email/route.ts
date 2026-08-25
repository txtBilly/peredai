import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/twilio';

// Dev-only helper to smoke-test email delivery end to end.
// Usage:  GET /api/dev/test-email?secret=<CRON_SECRET>&to=someone@ya.ru
// Guarded by CRON_SECRET so it can't be triggered by anyone. On the SMTP
// path, sendEmail throws on connection/auth/relay errors — we catch and
// return the exact message so failures are visible (incl. "domain on
// moderation" style rejections from SMTP.bz).
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const to = req.nextUrl.searchParams.get('to');
  if (!to) return NextResponse.json({ error: 'missing ?to=<email>' }, { status: 400 });

  try {
    await sendEmail({
      to,
      subject: 'Ten2Ten — тестовое письмо',
      html:
        '<div style="font-family:sans-serif;font-size:15px;line-height:1.5">' +
        '<p>Это тестовое письмо от <b>Ten2Ten</b> через SMTP.bz.</p>' +
        '<p>Если вы его видите — доставка работает. 🎉</p>' +
        '</div>',
    });
    return NextResponse.json({
      ok: true,
      to,
      provider: process.env.EMAIL_PROVIDER ?? 'auto',
      from: process.env.SMTP_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
