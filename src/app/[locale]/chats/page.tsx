import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type ChatRow = {
  id: string;
  seeker_id: string;
  lister_id: string;
  disclosed_seeker_name: string | null;
  listing: { neighborhood: string | null; cross_streets: string | null; contact_name: string | null } | null;
};

// The user's open conversations. A member can hold one as a renter and one as a
// lister at once; both are listed here (linked from the Chat nav).
export default async function ChatsPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const c = d.chats;

  const user = await requireUser(locale);
  const supabase = createClient();
  const { data } = await supabase
    .from('chats')
    .select(
      'id, seeker_id, lister_id, disclosed_seeker_name, listing:listings(neighborhood, cross_streets, contact_name)'
    )
    .or(`seeker_id.eq.${user.id},lister_id.eq.${user.id}`)
    .eq('status', 'active')
    .order('opened_at', { ascending: false });

  const chats = (data ?? []) as unknown as ChatRow[];

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="mb-6 font-display text-2xl text-ink">{c.title}</h1>

        {chats.length === 0 ? (
          <p className="text-sm text-muted">{c.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {chats.map((chat) => {
              const asRenter = chat.seeker_id === user.id;
              const roleLabel = asRenter ? c.asRenter : c.asLister;
              const place = chat.listing?.neighborhood ?? chat.listing?.cross_streets ?? '';
              const other = asRenter ? chat.listing?.contact_name ?? '' : chat.disclosed_seeker_name ?? '';
              return (
                <li key={chat.id}>
                  <Link
                    href={`/${locale}/chats/${chat.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white p-4 transition hover:border-black/20 hover:bg-black/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-cobalt">{roleLabel}</p>
                      <p className="truncate font-medium text-ink">{place || '—'}</p>
                      {other && <p className="truncate text-sm text-muted">{other}</p>}
                    </div>
                    <span aria-hidden="true" className="shrink-0 text-muted">
                      ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
