import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/adminAuth';
import { normalizeCouponCode } from '@/lib/coupons';

// Staff-only: create a coupon.
const KINDS = new Set(['percent', 'fixed', 'free']);

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = normalizeCouponCode(typeof body.code === 'string' ? body.code : '');
  const kind = typeof body.kind === 'string' ? body.kind : '';
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });

  const int = (v: unknown, def = 0) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? n : def;
  };
  let value = kind === 'free' ? 0 : int(body.value, 0);
  if (value < 0) value = 0;
  if (kind === 'percent' && value > 100) value = 100;
  const bonusCredits = Math.max(0, int(body.bonus_credits, 0));
  const maxRedemptions =
    body.max_redemptions == null || body.max_redemptions === '' ? null : Math.max(1, int(body.max_redemptions, 1));
  const expiresAt =
    typeof body.expires_at === 'string' && body.expires_at ? new Date(body.expires_at).toISOString() : null;
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

  const admin = createAdminClient();
  const { error } = await admin.from('coupons').insert({
    code,
    kind,
    value,
    bonus_credits: bonusCredits,
    max_redemptions: maxRedemptions,
    expires_at: expiresAt,
    note,
    active: true,
  });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'code_exists' }, { status: 409 });
    console.error('[admin] coupon create failed', error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
