import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';

// Atomic Connect: opens a chat by calling the open_connect_chat DB function,
// which consumes a credit, locks the listing, and snapshots the disclosed
// identity — all in one transaction. Called with the seeker's auth context so
// auth.uid() inside the function is the caller.
const KNOWN_ERRORS = new Set([
  'not_authenticated',
  'not_verified',
  'listing_not_found',
  'listing_unavailable',
  'own_listing',
  'below_min_score',
  'no_credits',
  'active_chat_exists',
  'account_restricted',
]);

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
  const listingId = (body as { listingId?: unknown })?.listingId;
  if (typeof listingId !== 'string' || !listingId) {
    return NextResponse.json({ error: 'missing_listing_id' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('open_connect_chat', { p_listing_id: listingId });

  if (error) {
    // The function raises named exceptions (e.g. 'no_credits'); surface the
    // known ones as a clean 409 so the client can message them, and treat
    // anything unexpected as a 500.
    const code = KNOWN_ERRORS.has(error.message) ? error.message : 'connect_failed';
    const status = code === 'connect_failed' ? 500 : 409;
    if (status === 500) console.error('[connect] open_connect_chat failed', error);
    return NextResponse.json({ error: code }, { status });
  }

  // Notify the lister that a verified seeker connected (fire-and-forget — a
  // notification failure must not fail the connect).
  try {
    const admin = createAdminClient();
    const { data: listing } = await admin
      .from('listings')
      .select('lister_id, neighborhood')
      .eq('id', listingId)
      .maybeSingle();
    if (listing?.lister_id) {
      await notify.bidAccepted(listing.lister_id, listing.neighborhood ?? 'your area');
    }
  } catch (e) {
    console.error('[connect] notify failed', e);
  }

  return NextResponse.json({ chatId: data });
}
