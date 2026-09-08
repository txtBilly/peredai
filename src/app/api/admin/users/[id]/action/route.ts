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

    // Bind/unbind the ban to the verified bank identity so the person can't
    // re-register around it (one identity = one account).
    const { data: prof } = await admin
      .from('profiles')
      .select('verified_identity_key')
      .eq('id', params.id)
      .maybeSingle();
    const key = prof?.verified_identity_key as string | null | undefined;
    if (key) {
      if (banning) {
        await admin
          .from('banned_identities')
          .upsert({ identity_key: key, reason: `full_ban by ${staff.id.slice(0, 8)}` }, { onConflict: 'identity_key' });
      } else {
        await admin.from('banned_identities').delete().eq('identity_key', key);
      }
    }
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

  // Void tokens after a money refund (e.g. an SBP bank refund in Tochka). Writes
  // a negative 'refund_admin' ledger row so the balance drops. Guarded: you can
  // only void what's still on the balance — if it's 0 (already spent / nothing
  // left), voiding is blocked, which is also why a refund isn't warranted.
  if (action === 'void_tokens') {
    const n = Math.floor(Number((body as { amount?: unknown }).amount ?? 1));
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    }
    const { data: rows, error: balErr } = await admin
      .from('credit_ledger')
      .select('amount')
      .eq('seeker_id', params.id);
    if (balErr) {
      console.error('[admin] void balance lookup failed', balErr);
      return NextResponse.json({ error: 'balance_lookup_failed' }, { status: 500 });
    }
    const balance = ((rows as { amount: number }[] | null) ?? []).reduce((s, r) => s + r.amount, 0);
    if (balance <= 0) return NextResponse.json({ error: 'no_balance', balance }, { status: 400 });
    if (n > balance) return NextResponse.json({ error: 'exceeds_balance', balance }, { status: 400 });

    const { error } = await admin.from('credit_ledger').insert({
      seeker_id: params.id,
      event: 'refund_admin',
      amount: -n,
      note: `Admin void ${n} token(s) — bank refund, by ${staff.id.slice(0, 8)}`,
    });
    if (error) {
      console.error('[admin] void_tokens failed', error);
      return NextResponse.json({ error: 'void_failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, voided: n, balance: balance - n });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
