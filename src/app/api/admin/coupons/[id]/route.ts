import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/adminAuth';

// Staff-only: toggle a coupon's active flag, or delete it.
// Body: { action: 'activate' | 'deactivate' | 'delete' }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  const action = body.action;
  const admin = createAdminClient();

  if (action === 'activate' || action === 'deactivate') {
    const { error } = await admin
      .from('coupons')
      .update({ active: action === 'activate' })
      .eq('id', params.id);
    if (error) {
      console.error('[admin] coupon toggle failed', error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    // Redemptions cascade (FK on delete cascade). Safe to hard-delete an unused
    // coupon; a used one loses its redemption history, so prefer deactivate.
    const { error } = await admin.from('coupons').delete().eq('id', params.id);
    if (error) {
      console.error('[admin] coupon delete failed', error);
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
