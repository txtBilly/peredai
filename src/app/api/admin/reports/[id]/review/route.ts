import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { confirmReport, dismissReport } from '@/lib/moderation';

// Staff-gated report review (the admin UI calls this). Distinct from the
// secret-gated /api/reports/[id]/review — this authorizes by the signed-in
// staff session. Both funnel into the same idempotent moderation logic.
async function requireStaff() {
  const user = await getUser();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('is_staff').eq('id', user.id).maybeSingle();
  return data?.is_staff ? user : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: unknown }).action;

  let result: { ok: true } | { error: string };
  if (action === 'confirm') {
    result = await confirmReport(params.id, staff.id);
  } else if (action === 'dismiss') {
    result = await dismissReport(params.id, staff.id);
  } else {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  if ('error' in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
