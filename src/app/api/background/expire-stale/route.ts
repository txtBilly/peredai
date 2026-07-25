import { NextRequest, NextResponse } from 'next/server';
import { voidStaleAuthorizations } from '@/lib/backgroundCheckPayments';

// Voids any bg_check_authorizations still 'authorized' >24h after creation —
// the seeker never submitted the verify form, so nothing was ever captured.
// This one makes Stripe calls, so it must run through the app: at deploy, wire
// pg_cron + pg_net to POST here. Gated by CRON_SECRET when set (so only the
// scheduler can trigger it); open in dev when the secret is unset.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await voidStaleAuthorizations();
    return NextResponse.json(result);
  } catch (e) {
    console.error('[background] expire-stale sweep failed', e);
    return NextResponse.json({ error: 'sweep_failed' }, { status: 500 });
  }
}
