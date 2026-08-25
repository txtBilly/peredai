'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// The home route is role-based:
//   - a user with a live listing (active or negotiating) → their dashboard
//   - everyone else (anonymous visitors and seekers) → Browse
// Browse is effectively the home page; this component just routes to the
// right destination. Locale is already validated by the layout.
export default function Home({ params }: { params: { locale: string } }) {
  const locale = params.locale;
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        // An open conversation is the default landing spot for both parties.
        // Two open chats (renter + lister) → the chat list; one → that chat.
        const { data: chats } = await supabase
          .from('chats')
          .select('id')
          .or(`seeker_id.eq.${user.id},lister_id.eq.${user.id}`)
          .eq('status', 'active')
          .limit(2);
        if (chats && chats.length > 0) {
          router.replace(chats.length === 1 ? `/${locale}/chats/${chats[0].id}` : `/${locale}/chats`);
          return;
        }

        const { data: active } = await supabase
          .from('listings')
          .select('id')
          .eq('lister_id', user.id)
          .in('status', ['active', 'negotiating'])
          .limit(1)
          .maybeSingle();
        if (active) {
          router.replace(`/${locale}/list/mine`);
          return;
        }
      }
      router.replace(`/${locale}/browse`);
    });
  }, [locale, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 text-center">
      <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Peredai</p>
      <p className="text-sm text-muted">Loading…</p>
    </main>
  );
}
