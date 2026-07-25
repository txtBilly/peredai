import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// File a report against the other party in a chat, or against a listing/its
// lister from the listing page. Creates a `reports` row (status defaults to
// 'open'); support confirms or dismisses it later (moderation.ts / Session 6).
const REASONS = new Set(['unresponsive', 'unavailable', 'inaccurate', 'fraudulent', 'something_else']);

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
  const { reason, detail, chatId, listingId } = (body ?? {}) as Record<string, unknown>;
  if (typeof reason !== 'string' || !REASONS.has(reason)) {
    return NextResponse.json({ error: 'invalid_reason' }, { status: 422 });
  }
  // Every report requires a written explanation.
  if (typeof detail !== 'string' || !detail.trim()) {
    return NextResponse.json({ error: 'detail_required' }, { status: 422 });
  }

  const admin = createAdminClient();
  let reportedUser: string | null = null;
  let finalListingId: string | null = null;
  let finalChatId: string | null = null;

  if (typeof chatId === 'string' && chatId) {
    const { data: chat } = await admin
      .from('chats')
      .select('id, seeker_id, lister_id, listing_id')
      .eq('id', chatId)
      .maybeSingle();
    if (!chat) return NextResponse.json({ error: 'chat_not_found' }, { status: 404 });
    if (user.id !== chat.seeker_id && user.id !== chat.lister_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    reportedUser = user.id === chat.seeker_id ? chat.lister_id : chat.seeker_id;
    finalListingId = chat.listing_id;
    finalChatId = chat.id;
  } else if (typeof listingId === 'string' && listingId) {
    const { data: listing } = await admin
      .from('listings')
      .select('id, lister_id')
      .eq('id', listingId)
      .maybeSingle();
    if (!listing) return NextResponse.json({ error: 'listing_not_found' }, { status: 404 });
    reportedUser = listing.lister_id;
    finalListingId = listing.id;
  } else {
    return NextResponse.json({ error: 'missing_context' }, { status: 400 });
  }

  const { error } = await admin.from('reports').insert({
    reporter_id: user.id,
    reported_user: reportedUser,
    listing_id: finalListingId,
    chat_id: finalChatId,
    reason,
    detail: typeof detail === 'string' && detail.trim() ? detail.trim() : null,
  });
  if (error) {
    console.error('[reports] insert failed', error);
    return NextResponse.json({ error: 'report_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
