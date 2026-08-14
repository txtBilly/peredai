import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { dispatchListingFreed } from '@/lib/notify';

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
    // Timestamp before the sweep so we can find exactly the chats it auto-freed
    // in this run (closed_reason 'auto_freed', closed_at >= sweepStart) — no
    // overlap with earlier runs or user-initiated closes.
    const sweepStart = new Date().toISOString();
    const { data, error } = await admin.rpc('sweep_chat_deadlines');
    if (error) {
      console.error('[chats] sweep_chat_deadlines failed', error);
      return NextResponse.json({ error: 'sweep_failed' }, { status: 500 });
    }

    // Alert savers of every listing this sweep put back on the market.
    let notified = 0;
    if ((data ?? 0) > 0) {
      const { data: freedChats } = await admin
        .from('chats')
        .select('listing_id')
        .eq('closed_reason', 'auto_freed')
        .gte('closed_at', sweepStart);
      const listingIds = Array.from(
        new Set((freedChats ?? []).map((c) => c.listing_id).filter((lid): lid is string => !!lid))
      );
      const counts = await Promise.allSettled(listingIds.map((lid) => dispatchListingFreed(lid)));
      notified = counts.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
    }

    return NextResponse.json({ closed: data ?? 0, notified });
  } catch (e) {
    console.error('[chats] expire-stale sweep failed', e);
    return NextResponse.json({ error: 'sweep_failed' }, { status: 500 });
  }
}
