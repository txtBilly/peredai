'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Full-ban lockout: a fully-banned member is sent to the banned notice and can
// go no further. (Shadow-ban is silent and handled per-action, not here.) Safe
// to call from any server component EXCEPT the banned page itself.
export async function redirectIfBanned(locale = 'en', userId?: string) {
  const supabase = createClient();
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id;
  }
  if (!uid) return;
  const { data } = await supabase.from('profiles').select('is_banned').eq('id', uid).maybeSingle();
  if (data?.is_banned) redirect(`/${locale}/banned`);
}

// Use in protected server components / actions. Redirects if unauthenticated,
// and sends fully-banned members to the banned notice.
export async function requireUser(locale = 'en') {
  const user = await getUser();
  if (!user) redirect(`/${locale}/signin`);
  await redirectIfBanned(locale, user.id);
  return user;
}
