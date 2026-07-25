import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/adminAuth';

// Staff-only listing moderation: hide (suspended) or restore (active).
const STATUSES = new Set(['active', 'suspended']);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const status = (body as { status?: unknown }).status;
  if (typeof status !== 'string' || !STATUSES.has(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('listings').update({ status }).eq('id', params.id);
  if (error) {
    console.error('[admin] listing moderate failed', error);
    return NextResponse.json({ error: 'moderate_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status });
}
