import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Sign the admin out and return to the admin login. Clears the Supabase session
// cookies via signOut().
export async function POST(req: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${req.nextUrl.origin}/admin/login`, 303);
}
