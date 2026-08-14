import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { dispatchListingFreed } from '@/lib/notify';

// Fan-out alert: when a listing returns to the market (its chat closed without a
// deal), email everyone who saved it — that's the "a saved listing becomes
// available" notification. Called by the lister's client right after they close
// a conversation as "didn't work out" (and by the stale-chat sweep). Guarded so
// only the listing owner can trigger it, and only while the listing is active.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const listingId = params.id;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from('listings')
    .select('id, lister_id, neighborhood, status')
    .eq('id', listingId)
    .maybeSingle();

  if (!listing) return NextResponse.json({ error: 'listing_not_found' }, { status: 404 });

  // Authorization: the trigger comes from whoever just closed the conversation —
  // that's the seeker (close_chat) or the lister (decline_success). Allow either
  // participant; reject anyone with no chat history on this listing.
  let authorized = listing.lister_id === user.id;
  if (!authorized) {
    const { data: ownChat } = await admin
      .from('chats')
      .select('id')
      .eq('listing_id', listingId)
      .eq('seeker_id', user.id)
      .limit(1)
      .maybeSingle();
    authorized = !!ownChat;
  }
  if (!authorized) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Only notify when the listing is genuinely back on the market.
  if (listing.status !== 'active') return NextResponse.json({ notified: 0, skipped: 'not_active' });

  // Skip the person who just closed the chat — they already know.
  const notified = await dispatchListingFreed(listingId, [user.id]);
  return NextResponse.json({ notified });
}
