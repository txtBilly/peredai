import { NextRequest, NextResponse } from 'next/server';
import { confirmReport, dismissReport } from '@/lib/moderation';

// Confirm or dismiss a report. Service-role/staff-only. Until the admin session
// auth lands in Session 6, this is gated by a shared secret (MODERATION_SECRET);
// the Session 6 admin UI will call it with proper staff auth. The consequence
// logic in moderation.ts is idempotent, so retries are safe.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const secret = process.env.MODERATION_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = (body as { action?: unknown })?.action;
  const reviewerRaw = (body as { reviewerId?: unknown })?.reviewerId;
  const reviewerId = typeof reviewerRaw === 'string' && reviewerRaw ? reviewerRaw : null;

  let result: { ok: true } | { error: string };
  if (action === 'confirm') {
    result = await confirmReport(params.id, reviewerId);
  } else if (action === 'dismiss') {
    result = await dismissReport(params.id, reviewerId);
  } else {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  if ('error' in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
