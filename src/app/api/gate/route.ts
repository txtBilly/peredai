import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

// Verifies the shared pre-launch passcode and, on success, sets the unlock
// cookie the middleware checks. Must hash the code the SAME way the middleware
// does so the two agree.
function gateToken(passcode: string): string {
  return crypto.createHash('sha256').update(`ten2ten-gate:${passcode}`).digest('hex');
}

// Only allow internal, same-site redirect targets.
function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const code = form?.get('code');
  const next = safeNext(form?.get('next'));

  const passcode = process.env.SITE_PASSCODE;
  // Gate disabled → just let them through.
  if (!passcode) {
    return NextResponse.redirect(new URL(next, req.url), 303);
  }

  if (typeof code !== 'string' || code !== passcode) {
    // Wrong code → back to the gate with an error flag, preserving the target.
    const back = new URL(req.headers.get('referer') ?? '/', req.url);
    back.searchParams.set('error', '1');
    back.searchParams.set('next', next);
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set('t2t_gate', gateToken(passcode), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
