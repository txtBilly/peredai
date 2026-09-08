import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Dedicated admin sign-in. Verifies an email+password Supabase account and
// requires the e-mail to be in the ADMIN_EMAILS allowlist. Separate from the
// consumer Sber ID / magic-link flow — a normal member's credentials, even if
// valid, are rejected unless the e-mail is allowlisted.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const form = await req.formData().catch(() => null);
  const email = String(form?.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(form?.get('password') ?? '');
  const back = (e: string) => NextResponse.redirect(`${origin}/admin/login?error=${e}`, 303);

  if (!email || !password) return back('missing');
  // Fail fast for non-allowlisted e-mails — don't even attempt a sign-in.
  if (!isAdminEmail(email)) return back('not_admin');

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return back('invalid');

  // Defensive: the signed-in identity must itself be allowlisted.
  if (!isAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    return back('not_admin');
  }

  return NextResponse.redirect(`${origin}/admin`, 303);
}
