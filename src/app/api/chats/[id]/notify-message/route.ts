import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';

// Fire-and-forget: after a participant sends a chat message, notify the other
// party (per their chat_message channel prefs). Kept separate from the message
// insert (which is a direct RLS insert for realtime immediacy).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: chat } = await admin
    .from('chats')
    .select('seeker_id, lister_id, disclosed_seeker_name')
    .eq('id', params.id)
    .maybeSingle();
  if (!chat) return NextResponse.json({ error: 'chat_not_found' }, { status: 404 });
  if (user.id !== chat.seeker_id && user.id !== chat.lister_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const recipientId = user.id === chat.seeker_id ? chat.lister_id : chat.seeker_id;
  const senderName = user.id === chat.seeker_id ? chat.disclosed_seeker_name ?? 'A seeker' : 'The lister';
  try {
    await notify.chatMessage(recipientId, senderName);
  } catch (e) {
    console.error('[notify-message] failed', e);
  }
  return NextResponse.json({ ok: true });
}
