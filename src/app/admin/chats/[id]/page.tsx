import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Msg = { id: string; sender_id: string; body: string; created_at: string };
type Prof = { id: string; full_name: string | null; email: string | null };

// Staff-only, read-only view of a reported conversation. Uses the service role
// (admins aren't chat participants, so RLS would otherwise hide it). Messages
// are immutable and shown verbatim for review.
export default async function AdminChatPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: chat } = await admin
    .from('chats')
    .select('id, seeker_id, lister_id, listing_id, status, opened_at, closed_at, closed_reason')
    .eq('id', params.id)
    .maybeSingle();

  if (!chat) {
    return (
      <div>
        <Link href="/admin" className="text-sm text-gold hover:underline">‹ Back to reports</Link>
        <p className="mt-6 text-sm text-red-400">Chat not found.</p>
      </div>
    );
  }

  const [{ data: msgs }, { data: profs }] = await Promise.all([
    admin.from('messages').select('id, sender_id, body, created_at').eq('chat_id', params.id).order('created_at', { ascending: true }),
    admin.from('profiles').select('id, full_name, email').in('id', [chat.seeker_id, chat.lister_id]),
  ]);
  const messages = (msgs as Msg[] | null) ?? [];
  const profiles = (profs as Prof[] | null) ?? [];
  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    const label = p?.full_name || p?.email || id.slice(0, 8);
    const role = id === chat.seeker_id ? 'seeker' : id === chat.lister_id ? 'lister' : '';
    return role ? `${label} (${role})` : label;
  };

  return (
    <div>
      <Link href="/admin" className="text-sm text-gold hover:underline">‹ Back to reports</Link>

      <div className="mt-4 mb-6">
        <h1 className="font-display text-2xl text-paper">Conversation</h1>
        <p className="text-sm text-muted">
          {nameOf(chat.seeker_id)} ↔ {nameOf(chat.lister_id)} · status {chat.status}
          {chat.closed_reason ? ` (${chat.closed_reason})` : ''} · listing {chat.listing_id?.slice(0, 8)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">No messages.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2">
              <div className="mb-0.5 flex items-center justify-between text-xs text-muted">
                <span>{nameOf(m.sender_id)}</span>
                <span>{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-paper">{m.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
