'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { listingTypeLabel } from '@/lib/listings';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

// Copy here is functional, not final (part of the batched copy sweep).

type Chat = {
  id: string;
  seeker_id: string;
  lister_id: string;
  listing_id: string;
  status: string;
  opened_at: string;
  lister_close_requested_at: string | null;
  seeker_success_at: string | null;
  disclosed_seeker_name: string | null;
  disclosed_credit_score: number | null;
  disclosed_bg_status: string | null;
};

type Listing = {
  neighborhood: string | null;
  full_address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  monthly_rent: number | null;
  type: string | null;
  available_from: string | null;
  gratitude_amount: number | null;
};

type Message = { id: string; sender_id: string; body: string; created_at: string };

function creditBand(score: number | null): string {
  if (score == null) return 'Not available';
  if (score >= 800) return 'Excellent (800+)';
  if (score >= 740) return 'Very good (740–799)';
  if (score >= 670) return 'Good (670–739)';
  if (score >= 580) return 'Fair (580–669)';
  return 'Poor (below 580)';
}

export default function ChatView({ locale, id }: { locale: Locale; id: string }) {
  const l = getDictionary(locale).listing;
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [role, setRole] = useState<'seeker' | 'lister' | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actionError, setActionError] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setPhase('error');
        return;
      }
      setMyUserId(user.id);

      const { data: c } = await supabase
        .from('chats')
        .select(
          'id, seeker_id, lister_id, listing_id, status, opened_at, lister_close_requested_at, seeker_success_at, disclosed_seeker_name, disclosed_credit_score, disclosed_bg_status'
        )
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      const r = c ? (c.seeker_id === user.id ? 'seeker' : c.lister_id === user.id ? 'lister' : null) : null;
      if (!c || !r) {
        setPhase('error');
        return;
      }

      const [{ data: lst }, { data: msgs }] = await Promise.all([
        supabase
          .from('listings')
          .select('neighborhood, full_address, contact_name, contact_phone, monthly_rent, type, available_from, gratitude_amount')
          .eq('id', c.listing_id)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('id, sender_id, body, created_at')
          .eq('chat_id', id)
          .order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;

      setChat(c as Chat);
      setListing((lst as Listing) ?? null);
      setRole(r);
      setMessages((msgs as Message[]) ?? []);
      setPhase('ready');
    })();

    // Realtime: append new messages live. We use both postgres_changes (DB-
    // driven) and a broadcast the sender emits after insert — the broadcast is
    // the reliable path (no per-subscriber RLS evaluation), deduped by id.
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        }
      )
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const m = payload as Message;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !myUserId) return;
    setSending(true);
    setActionError('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ chat_id: id, sender_id: myUserId, body: text })
      .select('id, sender_id, body, created_at')
      .single();
    setSending(false);
    if (error || !data) {
      setActionError("Couldn't send. Please try again.");
      return;
    }
    const msg = data as Message;
    // Show my own message immediately, and notify the other party directly.
    setMessages((cur) => (cur.some((x) => x.id === msg.id) ? cur : [...cur, msg]));
    channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
    // Notify the other party per their prefs (fire-and-forget).
    fetch(`/api/chats/${id}/notify-message`, { method: 'POST' }).catch(() => {});
    // A seeker reply re-engages the chat and cancels a pending close request
    // (the DB trigger does this too; mirror it locally for immediate feedback).
    if (role === 'seeker') {
      setChat((c) => (c && c.lister_close_requested_at ? { ...c, lister_close_requested_at: null } : c));
    }
    setBody('');
  }

  // When a conversation ends without a deal the listing goes back on the market.
  // Tell everyone who saved it (fire-and-forget — never blocks the close flow).
  function notifyListingFreed() {
    if (!chat?.listing_id) return;
    fetch(`/api/listings/${chat.listing_id}/notify-freed`, { method: 'POST' }).catch(() => {});
  }

  async function handleClose(reason: 'closed_success' | 'closed_didnt_work') {
    setClosing(true);
    setActionError('');
    const { error } = await supabase.rpc('close_chat', { p_chat_id: id, p_reason: reason });
    setClosing(false);
    if (error) {
      setActionError(`Couldn't close the conversation (${error.message || 'error'}).`);
      return;
    }
    setChat((c) => (c ? { ...c, status: reason } : c));
    setCloseOpen(false);
    if (reason === 'closed_didnt_work') notifyListingFreed();
  }

  async function handleRequestClose() {
    setClosing(true);
    setActionError('');
    const { error } = await supabase.rpc('request_close_chat', { p_chat_id: id });
    setClosing(false);
    if (error) {
      setActionError(`Couldn’t request close (${error.message || 'error'}).`);
      return;
    }
    setChat((c) => (c ? { ...c, lister_close_requested_at: new Date().toISOString() } : c));
  }

  async function handleReportSuccess() {
    setClosing(true);
    setActionError('');
    const { error } = await supabase.rpc('report_success', { p_chat_id: id });
    setClosing(false);
    if (error) {
      setActionError(`Couldn’t report success (${error.message || 'error'}).`);
      return;
    }
    setChat((c) => (c ? { ...c, seeker_success_at: new Date().toISOString() } : c));
    setCloseOpen(false);
  }

  async function handleConfirmSuccess() {
    setClosing(true);
    setActionError('');
    const { error } = await supabase.rpc('confirm_success', { p_chat_id: id });
    setClosing(false);
    if (error) {
      setActionError(`Couldn’t confirm (${error.message || 'error'}).`);
      return;
    }
    setChat((c) => (c ? { ...c, status: 'closed_success' } : c));
  }

  async function handleDeclineSuccess() {
    setClosing(true);
    setActionError('');
    const { error } = await supabase.rpc('decline_success', { p_chat_id: id });
    setClosing(false);
    if (error) {
      setActionError(`Couldn’t decline (${error.message || 'error'}).`);
      return;
    }
    // Declining frees the listing immediately and closes the chat.
    setChat((c) => (c ? { ...c, status: 'closed_didnt_work', seeker_success_at: null } : c));
    notifyListingFreed();
  }

  async function handleConfirmClose() {
    setClosing(true);
    setActionError('');
    const { error } = await supabase.rpc('confirm_close_chat', { p_chat_id: id });
    setClosing(false);
    if (error) {
      setActionError(`Couldn’t close the conversation (${error.message || 'error'}).`);
      return;
    }
    setChat((c) => (c ? { ...c, status: 'closed_didnt_work' } : c));
    notifyListingFreed();
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 text-center">
        <p className="text-sm text-muted">Loading conversation…</p>
      </main>
    );
  }

  if (phase === 'error' || !chat) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        <p className="mb-4 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
        <p role="alert" className="mb-6 text-sm text-red-600">
          This conversation isn’t available.
        </p>
        <Link href={`/${locale}/browse`} className="text-sm text-cobalt hover:underline">
          Back to Browse
        </Link>
      </main>
    );
  }

  const isActive = chat.status === 'active';
  const successReported = !!chat.seeker_success_at;
  const closeRequested = !!chat.lister_close_requested_at;
  // Whoever did NOT send the last message owes the next one. The lister may only
  // request close when the SEEKER owes a reply — i.e. the lister (or nobody)
  // spoke last and the seeker has stayed silent ≥24h. If the seeker spoke last,
  // the lister owes the reply and can't claim the seeker went quiet.
  const lastMsg = messages.length ? messages[messages.length - 1] : null;
  const seekerSpokeLast = !!lastMsg && lastMsg.sender_id === chat.seeker_id;
  const lastActivityAt = lastMsg ? lastMsg.created_at : chat.opened_at;
  const seekerIdleHrs = (Date.now() - new Date(lastActivityAt).getTime()) / 3_600_000;
  const listerCanRequest =
    role === 'lister' &&
    isActive &&
    !closeRequested &&
    !successReported &&
    !seekerSpokeLast &&
    seekerIdleHrs >= 24;
  const otherName = role === 'seeker' ? listing?.contact_name ?? '—' : chat.disclosed_seeker_name ?? '—';
  const gratuityLabel =
    listing?.gratitude_amount != null && listing.gratitude_amount > 0
      ? `$${listing.gratitude_amount.toLocaleString('en-US')}`
      : null;
  const listingLine = listing
    ? [
        listing.type ? listingTypeLabel(listing.type, l) : null,
        listing.monthly_rent != null ? `$${listing.monthly_rent.toLocaleString('en-US')}/mo` : null,
        gratuityLabel ? `${gratuityLabel} one-time gratuity` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const availableLabel = listing?.available_from
    ? new Date(listing.available_from).toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const closedLabel =
    chat.status === 'closed_success'
      ? 'This conversation was closed — marked as a success.'
      : chat.status === 'closed_didnt_work'
        ? 'This conversation was closed — didn’t work out.'
        : 'This conversation is closed.';

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-5 py-8">
      {/* Header: actions row on top (left-aligned), identity card beneath */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {isActive && role === 'seeker' && !successReported && (
            <button
              type="button"
              onClick={() => setCloseOpen((v) => !v)}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-100"
            >
              Terminate chat
            </button>
          )}
          <Link href={`/${locale}/chats/${id}/report`} className="text-sm text-muted hover:text-ink">
            Report
          </Link>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-3 text-sm">
          {role === 'seeker' ? (
            <div className="space-y-3">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="whitespace-nowrap text-[1.23rem] font-bold text-ink">{otherName}</span>
                <span className="whitespace-nowrap font-semibold text-leaf">✓ Verified ID by Stripe</span>
              </p>
              {listing?.full_address && (
                <p className="text-[1.26rem] text-ink">
                  <span className="text-ink">Address:</span> {listing.full_address}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted">
              <span className="text-ink">Seeker:</span> {chat.disclosed_seeker_name ?? '—'} · Credit band:{' '}
              {creditBand(chat.disclosed_credit_score)} ·{' '}
              {chat.disclosed_bg_status === 'verified' ? 'Verified' : '—'}
            </p>
          )}
        </div>
      </div>

      {/* Listing summary */}
      <div className="mb-4">
        {listing?.neighborhood && (
          <h1 className="font-display text-2xl">
            <Link href={`/${locale}/browse/${chat.listing_id}`} className="text-cobalt underline decoration-cobalt/40 underline-offset-4 hover:decoration-cobalt">
              {listing.neighborhood}
            </Link>
          </h1>
        )}
        {listingLine && <p className="mt-1.5 text-[1.26rem] text-ink">{listingLine}</p>}
        {availableLabel && (
          <p className="mt-1.5 text-[1.26rem] text-ink">Available: {availableLabel}</p>
        )}
      </div>

      {/* Pending success — seeker reported "got the place", awaiting the lister */}
      {isActive && successReported && role === 'seeker' && (
        <div className="mb-4 rounded-xl border border-cobalt/30 bg-cobalt/5 p-4">
          <p className="mb-1 font-medium text-ink">You reported getting the place.</p>
          <p className="text-xs text-muted">
            Waiting for the lister to confirm. If they don’t respond, it closes automatically after 24 hours.
          </p>
        </div>
      )}
      {isActive && successReported && role === 'lister' && (
        <div className="mb-4 rounded-xl border border-cobalt/30 bg-cobalt/5 p-4">
          <p className="mb-1 font-medium text-ink">{otherName} reported getting the place.</p>
          <p className="mb-3 text-xs text-muted">
            Confirm to take your listing off-market, or decline if that’s not right. If you do nothing, it closes
            automatically after 24 hours.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={closing}
              onClick={handleConfirmSuccess}
              className="rounded-lg bg-gradient-cobalt px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
            >
              Confirm — take off-market
            </button>
            <button
              type="button"
              disabled={closing}
              onClick={handleDeclineSuccess}
              className="rounded-lg border border-black/15 px-4 py-2 text-sm text-ink transition hover:border-black/30 disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Lister close-request / seeker confirm */}
      {isActive && closeRequested && role === 'seeker' && (
        <div className="mb-4 rounded-xl border border-cobalt/30 bg-cobalt/5 p-4">
          <p className="mb-1 font-medium text-ink">The lister asked to close this chat.</p>
          <p className="mb-3 text-xs text-muted">
            Confirm to release it, or just send a message to keep it active. If you do nothing, it closes
            automatically after 24 hours.
          </p>
          <button
            type="button"
            disabled={closing}
            onClick={handleConfirmClose}
            className="rounded-lg bg-gradient-cobalt px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            Confirm close
          </button>
        </div>
      )}
      {isActive && closeRequested && role === 'lister' && (
        <div className="mb-4 rounded-xl border border-black/10 bg-white p-3 text-sm text-muted">
          Close requested — the seeker has 24h to respond or the chat auto-frees.
        </div>
      )}
      {listerCanRequest && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3">
          <p className="text-sm text-muted">The seeker hasn’t replied in over 24 hours.</p>
          <button
            type="button"
            disabled={closing}
            onClick={handleRequestClose}
            className="shrink-0 rounded-lg border border-black/15 px-3 py-1.5 text-sm text-ink transition hover:border-black/30 disabled:opacity-60"
          >
            Request close
          </button>
        </div>
      )}

      {/* Close panel — modal overlay so the choice is unmissable */}
      {closeOpen && isActive && role === 'seeker' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminate-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !closing && setCloseOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="terminate-title" className="mb-1 font-display text-2xl text-ink">
              How did it go?
            </h2>
            <p className="mb-5 text-sm text-muted">
              Terminating ends this conversation. Choose an outcome — “Didn’t work out” uses this credit and lets you
              open your next one.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={closing}
                onClick={handleReportSuccess}
                className="w-full rounded-lg bg-gradient-cobalt px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                Got the place
              </button>
              <button
                type="button"
                disabled={closing}
                onClick={() => handleClose('closed_didnt_work')}
                className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-100 disabled:opacity-60"
              >
                Didn’t work out
              </button>
              <button
                type="button"
                disabled={closing}
                onClick={() => setCloseOpen(false)}
                className="w-full rounded-lg px-4 py-2.5 text-sm text-muted transition hover:text-ink disabled:opacity-60"
              >
                Keep chatting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety message — pinned first in the thread */}
      <ul className="mb-3 list-disc space-y-1 rounded-lg border border-black/10 bg-black/[0.02] py-3 pl-8 pr-4 text-xs leading-relaxed text-muted">
        <li>Keep the conversation on Ten2Ten.</li>
        <li>Never share sensitive financial details, and meet in a safe, public space.</li>
        <li>Verify by asking for physical ID when you meet in person.</li>
        {role === 'seeker' ? (
          <>
            <li>Ask if the gratuity is negotiable.</li>
            <li>Don’t pay in advance.</li>
            <li>Ask for a receipt for any money paid.</li>
            <li>Your credit score has been shared with the lister already.</li>
          </>
        ) : (
          <>
            <li>Communicate with the landlord to make sure the prospective tenant can meet the requirements.</li>
            <li>
              We’ve shared a verified credit-score range for this prospective renter — ask them for the precise
              figure if you need it.
            </li>
            <li>
              Don’t take any advances until you’re certain the tenant is a good fit, and before discussing important
              details such as the move-in date.
            </li>
            <li>Be honest when disclosing any critical details about the place, to the best of your knowledge.</li>
          </>
        )}
      </ul>

      {/* Thread */}
      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myUserId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? 'bg-gradient-cobalt text-white'
                      : 'bg-gradient-to-br from-fuchsia-600 to-pink-500 text-white'
                  }`}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 text-[10px] text-muted">{mine ? 'You' : otherName}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {actionError && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {actionError}
        </p>
      )}

      {/* Composer */}
      {isActive ? (
        <form onSubmit={handleSend} className="mt-2 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            className="flex-1 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-lg bg-gradient-cobalt px-5 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : (
        <div className="mt-2 rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-center text-sm text-muted">
          <p className="mb-2">{closedLabel}</p>
          <Link href={`/${locale}/chats/${id}/rate`} className="text-cobalt hover:underline">
            Rate this conversation
          </Link>
        </div>
      )}
    </main>
  );
}
