import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/adminAuth';

// Staff-only member actions: shadow-ban / unban, and a manual credit refund
// override (grants +1 to the member's ledger).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: unknown }).action;
  const admin = createAdminClient();

  if (action === 'ban' || action === 'unban') {
    const { error } = await admin
      .from('profiles')
      .update({ is_shadow_banned: action === 'ban' })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: 'action_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'full_ban' || action === 'lift_full_ban') {
    const banning = action === 'full_ban';
    const { error } = await admin
      .from('profiles')
      .update({ is_banned: banning, banned_at: banning ? new Date().toISOString() : null })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: 'action_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'clear_review') {
    // Clears the suspected-duplicate flag so the member can publish listings.
    const { error } = await admin
      .from('profiles')
      .update({ duplicate_review: false, duplicate_reason: null, duplicate_matched_id: null })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: 'action_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'refund') {
    const { error } = await admin.from('credit_ledger').insert({
      seeker_id: params.id,
      event: 'refund_report',
      amount: 1,
      note: `Admin refund override by ${staff.id.slice(0, 8)}`,
    });
    if (error) {
      console.error('[admin] refund override failed', error);
      return NextResponse.json({ error: 'refund_failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
