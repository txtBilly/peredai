import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Sweeps chat deadlines via the sweep_chat_deadlines() DB function: auto-frees
// first-message no-shows and lister-close timeouts, and auto-confirms pending
// successes past 24h.
//
// The state changes are already scheduled directly in Postgres via pg_cron
// (`select cron.schedule('chat-deadlines','*/15 * * * *', $$ select
// sweep_chat_deadlines(); $$)`). This route stays as an on-demand entry point
// and, once deployed, the place to attach notification fan-out (expiry_warn /
// listing_freed) via pg_net. Gated by CRON_SECRET when set.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('sweep_chat_deadlines');
    if (error) {
      console.error('[chats] sweep_chat_deadlines failed', error);
      return NextResponse.json({ error: 'sweep_failed' }, { status: 500 });
    }
    return NextResponse.json({ closed: data ?? 0 });
  } catch (e) {
    console.error('[chats] expire-stale sweep failed', e);
    return NextResponse.json({ error: 'sweep_failed' }, { status: 500 });
  }
}
