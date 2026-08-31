import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/twilio';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@ten2ten.ru';
// Email links must never point at localhost — support clicks them from their
// inbox. Use the configured URL only when it's a real host; otherwise the prod domain.
function appUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
  return raw && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(raw) ? raw : 'https://ten2ten.ru';
}
const APP_URL = appUrl();

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A signed-in member sends a message to support. We attach the context support
// needs to act: the member's name + email, a link to their active chat (if any),
// and links to their listings (if any). The email's reply-to is the member, so
// replying from the support inbox reaches them directly.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { message?: unknown; subject?: unknown };
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 140) : '';
  if (!message) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('display_first_name, full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  const name = profile?.full_name || profile?.display_first_name || user.email || 'Пользователь';
  const email = profile?.email || user.email || '';

  // Most recent active chat where the member is either party.
  const { data: chat } = await admin
    .from('chats')
    .select('id')
    .or(`seeker_id.eq.${user.id},lister_id.eq.${user.id}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const chatLink = chat ? `${APP_URL}/ru/chats/${chat.id}` : null;

  // The member's own listings (as lister), newest first.
  const { data: listings } = await admin
    .from('listings')
    .select('id, neighborhood, status')
    .eq('lister_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);
  const listingLinks = (listings ?? []).map((l) => ({
    url: `${APP_URL}/ru/browse/${l.id}`,
    label: `${l.neighborhood ?? l.id}${l.status ? ` (${l.status})` : ''}`,
  }));

  const rows: string[] = [
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Имя</td><td style="padding:4px 0;color:#14140f;">${esc(name)}</td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Email</td><td style="padding:4px 0;color:#14140f;">${esc(email)}</td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">User&nbsp;ID</td><td style="padding:4px 0;color:#14140f;">${esc(user.id)}</td></tr>`,
  ];
  if (chatLink) {
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Чат</td><td style="padding:4px 0;"><a href="${chatLink}" style="color:#1B4DE4;">${chatLink}</a></td></tr>`
    );
  }
  if (listingLinks.length) {
    const items = listingLinks
      .map((l) => `<a href="${l.url}" style="color:#1B4DE4;">${esc(l.label)}</a>`)
      .join('<br>');
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;">Объявления</td><td style="padding:4px 0;">${items}</td></tr>`
    );
  }

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#14140f;">
    <p style="margin:0 0 12px;font-weight:600;">Новое обращение в поддержку</p>
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 16px;">${rows.join('')}</table>
    <div style="white-space:pre-wrap;border-left:3px solid #1B4DE4;padding:2px 0 2px 12px;color:#14140f;">${esc(
      message
    )}</div>
  </div>`;

  try {
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: subject ? `Поддержка: ${subject}` : `Обращение в поддержку — ${name}`,
      html,
      replyTo: email || undefined,
    });
  } catch (err) {
    console.error('[support] send failed', err);
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
