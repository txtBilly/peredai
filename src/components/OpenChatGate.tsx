'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// While a member has an open conversation, the chat is their home base: any
// genuine full page load (login / hard refresh / direct URL) lands there.
//
// This lives in the locale layout, which persists across in-app navigation, so
// the effect runs ONCE per full load and NOT on client-side link clicks — that
// distinction is what lets listers still navigate to Browse/List by clicking
// while a refresh of those same screens bounces back to the chat.
//
// Routes that ARE the chat (or belong to its flow) and auth/marketing-gate
// routes are skipped so we never loop or trap the user mid-task.
const SKIP = ['/chats', '/signin', '/signup', '/verify', '/banned', '/gate', '/background'];

export default function OpenChatGate({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (SKIP.some((s) => pathname.includes(s))) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: chats } = await supabase
        .from('chats')
        .select('id')
        .or(`seeker_id.eq.${user.id},lister_id.eq.${user.id}`)
        .eq('status', 'active')
        .limit(2);
      if (cancelled || !chats || chats.length === 0) return;
      // One open chat → straight to it; two (renter + lister) → the chat list.
      router.replace(chats.length === 1 ? `/${locale}/chats/${chats[0].id}` : `/${locale}/chats`);
    })();
    return () => {
      cancelled = true;
    };
    // Run once per full page load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
