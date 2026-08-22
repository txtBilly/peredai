import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  // Local scope: sign out only THIS device's session. The default 'global'
  // scope revokes every refresh token for the user, which would log them out
  // on all their other devices too.
  await supabase.auth.signOut({ scope: 'local' });

  // Redirect to home with locale from referrer, falling back to /en
  const referer = req.headers.get('referer') ?? '';
  const localeMatch = referer.match(/\/(en|es)\//);
  const locale = localeMatch ? localeMatch[1] : 'en';

  return NextResponse.redirect(new URL(`/${locale}`, req.url), { status: 302 });
}
