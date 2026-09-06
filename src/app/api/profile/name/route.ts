import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Set the signed-in seeker's display name (shown to the lister in chat). Used by
// the post-payment «Укажите Ваше имя» prompt. Writes with the service role; the
// DB's verified-name lock still applies to Sber-verified accounts.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }

  const admin = createAdminClient();
  // Set both the disclosed full_name (shown to the lister in chat) and the
  // display_first_name (shown on the account screen), so neither falls back to
  // the email prefix the signup trigger seeds.
  const { error } = await admin
    .from('profiles')
    .update({ full_name: name, display_first_name: name.split(' ')[0] })
    .eq('id', user.id);
  if (error) {
    console.error('[profile/name] update failed', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
