import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';

// Daily availability sweep over listings that are still 'active' (i.e. NOT in
// talks / 'negotiating'):
//   #3  move-in date has arrived (available_from <= today) → take the listing
//       down ('removed'). published_at is left intact, so the listing stays
//       counted against the 3-per-year limit (no slot refund).
//   #2  move-in date is 1–2 days out → send the lister a one-time nudge (still
//       available? consider lowering the gratitude), tracked via
//       availability_nudge_sent_at so it fires at most once.
//
// Invoked by Vercel Cron daily (see vercel.json). Vercel adds
// `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set; we enforce it
// when the secret is present (same pattern as the chat-deadlines sweep).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ruDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in2Str = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10);

  let takenDown = 0;
  let nudged = 0;

  // --- #3: take down listings whose move-in date has arrived, not in talks ---
  const { data: expired, error: expErr } = await admin
    .from('listings')
    .select('id, lister_id, neighborhood')
    .eq('status', 'active')
    .not('available_from', 'is', null)
    .lte('available_from', todayStr);
  if (expErr) console.error('[sweep-availability] expired query failed', expErr);

  for (const row of expired ?? []) {
    // Guard on status = 'active' so a listing that entered talks between the
    // read and the write is never taken down out from under a live chat.
    const { error: upErr } = await admin
      .from('listings')
      .update({ status: 'removed', lister_unseen: true })
      .eq('id', row.id)
      .eq('status', 'active');
    if (upErr) {
      console.error('[sweep-availability] takedown failed', row.id, upErr);
      continue;
    }
    takenDown++;
    try {
      await notify.listingTakenDown(row.lister_id as string, (row.neighborhood as string) ?? 'вашем районе');
    } catch (e) {
      console.error('[sweep-availability] takedown notify failed', row.id, e);
    }
  }

  // --- #2: nudge listings 1–2 days out, not in talks, not yet nudged ---
  const { data: soon, error: soonErr } = await admin
    .from('listings')
    .select('id, lister_id, neighborhood, available_from')
    .eq('status', 'active')
    .is('availability_nudge_sent_at', null)
    .gt('available_from', todayStr)
    .lte('available_from', in2Str);
  if (soonErr) console.error('[sweep-availability] soon query failed', soonErr);

  for (const row of soon ?? []) {
    // Send first; only mark as nudged on success so a failed send retries next
    // run rather than being silently swallowed.
    try {
      await notify.availabilityNudge(
        row.lister_id as string,
        (row.neighborhood as string) ?? 'вашем районе',
        row.id as string,
        ruDate(row.available_from as string)
      );
    } catch (e) {
      console.error('[sweep-availability] nudge notify failed', row.id, e);
      continue;
    }
    const { error: markErr } = await admin
      .from('listings')
      .update({ availability_nudge_sent_at: new Date().toISOString() })
      .eq('id', row.id);
    if (markErr) console.error('[sweep-availability] nudge mark failed', row.id, markErr);
    nudged++;
  }

  return NextResponse.json({ takenDown, nudged });
}
