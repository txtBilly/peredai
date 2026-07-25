import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Post-chat rating (1–5 + optional note), one per (chat, rater). A DB trigger
// recomputes the ratee's rating_avg/rating_count. Advisory only — ratings never
// trigger strikes/bans (that's reports).
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { chatId, stars, body: note } = (body ?? {}) as Record<string, unknown>;
  if (typeof chatId !== 'string' || !chatId) {
    return NextResponse.json({ error: 'missing_chat' }, { status: 400 });
  }
  const s = Number(stars);
  if (!Number.isInteger(s) || s < 1 || s > 5) {
    return NextResponse.json({ error: 'invalid_stars' }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: chat } = await admin
    .from('chats')
    .select('id, seeker_id, lister_id, status')
    .eq('id', chatId)
    .maybeSingle();
  if (!chat) return NextResponse.json({ error: 'chat_not_found' }, { status: 404 });
  if (user.id !== chat.seeker_id && user.id !== chat.lister_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (chat.status === 'active') {
    return NextResponse.json({ error: 'chat_not_closed' }, { status: 409 });
  }

  const ratee = user.id === chat.seeker_id ? chat.lister_id : chat.seeker_id;
  const { error } = await admin.from('ratings').insert({
    chat_id: chatId,
    rater_id: user.id,
    ratee_id: ratee,
    stars: s,
    body: typeof note === 'string' && note.trim() ? note.trim() : null,
  });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_rated' }, { status: 409 });
    console.error('[ratings] insert failed', error);
    return NextResponse.json({ error: 'rating_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
