'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { listingTypeLabel } from '@/lib/listings';
import { getDictionary, intlLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { formatRubles } from '@/lib/format';

// Ten2Ten app-icon tile (the favicon creative): cobalt→fuchsia squircle with the
// roof mark and "T2T". Used as the diagonal cover mark in the conversation header
// and, small, as the badge on the platform "Памятка" card.
function BrandTile({
  size = 32,
  className = '',
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className={className} style={style}>
      <defs>
        <linearGradient id="t2tGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B4DE4" />
          <stop offset="0.38" stopColor="#2A44E1" />
          <stop offset="0.66" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#t2tGrad)" />
      <polygon points="100,214 256,106 412,214" fill="#fff" />
      <text
        x="256"
        y="348"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontWeight="700"
        fontSize="168"
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        letterSpacing="-6"
      >
        T2T
      </text>
    </svg>
  );
}

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

export default function ChatView({ locale, id }: { locale: Locale; id: string }) {
  const dict = getDictionary(locale);
  const l = dict.listing;
  const c = dict.chat;
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
          'id, seeker_id, lister_id, listing_id, status, opened_at, lister_close_requested_at, seeker_success_at, disclosed_seeker_name, disclosed_bg_status'
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
      ? formatRubles(listing.gratitude_amount)
      : null;
  const gratuityLine = gratuityLabel ? `${gratuityLabel} ${c.gratuitySuffix}` : null;
  // Listing card lines: "Neighborhood · type" on top, "rent · gratuity" beneath.
  const typeLabel = listing?.type ? listingTypeLabel(listing.type, l) : null;
  const topLine = [listing?.neighborhood, typeLabel].filter(Boolean).join(' · ');
  const rentStr = listing?.monthly_rent != null ? formatRubles(listing.monthly_rent, { perMonth: true }) : null;
  const metaLine = [rentStr, gratuityLine].filter(Boolean).join(' · ');
  const availableLabel = listing?.available_from
    ? new Date(listing.available_from).toLocaleDateString(intlLocale(locale), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const closedLabel =
    chat.status === 'closed_success'
      ? c.closedSuccess
      : chat.status === 'closed_didnt_work'
        ? c.closedDidntWork
        : c.closed;

  // Other party's verification: the lister is always verified (posting requires it);
  // the seeker's status is disclosed to the lister when they've passed identity.
  const otherVerified = role === 'seeker' ? true : chat.disclosed_bg_status === 'verified';
  const initials =
    otherName && otherName !== '—'
      ? otherName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w.charAt(0).toUpperCase())
          .join('')
      : '—';
  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(intlLocale(locale), { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };
  // The platform's opening reminder — role-aware, shown once at the top of the thread.
  const reminderBullets =
    role === 'seeker'
      ? [
          'Ведите общение внутри Ten2Ten.',
          'Не передавайте конфиденциальные финансовые данные и встречайтесь в безопасном общественном месте.',
          'При личной встрече попросите показать документ, удостоверяющий личность.',
          'Уточните, обсуждается ли размер благодарности.',
          'Не платите заранее и просите расписку за любые переданные деньги.',
        ]
      : [
          'Ведите общение внутри Ten2Ten.',
          'Не передавайте конфиденциальные финансовые данные и встречайтесь в безопасном общественном месте.',
          'При личной встрече попросите показать документ, удостоверяющий личность.',
          'Согласуйте с собственником, что кандидат соответствует требованиям.',
          'Не берите предоплату, пока не убедитесь, что арендатор подходит, и до обсуждения важных деталей.',
          'Честно и по возможности полно раскрывайте важные детали о квартире.',
        ];

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-5 py-6">
      {/* Conversation header — branded cover tile with the app icon bleeding across */}
      <div
        className="relative mb-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-black/10 px-4 py-3.5"
        style={{ background: 'linear-gradient(115deg, rgba(27,77,228,.12), rgba(91,43,255,.08) 62%, rgba(255,255,255,.35))' }}
      >
        <BrandTile
          size={120}
          className="pointer-events-none absolute right-3 top-1/2"
          style={{ transform: 'translateY(-50%) rotate(-20deg)', opacity: 0.6, filter: 'drop-shadow(0 10px 20px rgba(27,40,120,.22))' }}
        />
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-cobalt text-sm font-bold text-white">
          {initials}
        </div>
        <div className="relative min-w-0">
          <div className="truncate text-[1.05rem] font-bold text-ink">{otherName}</div>
          {otherVerified && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-leaf">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="#0A9D57" />
                <path d="M5 8.2l2 2 4-4.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {c.verifiedId}
            </span>
          )}
        </div>
      </div>

      {/* Actions — full-width row */}
      <div className="mb-3 flex items-stretch gap-2">
        {isActive && role === 'seeker' && !successReported && (
          <button
            type="button"
            onClick={() => setCloseOpen((v) => !v)}
            className="flex-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-center text-sm font-semibold text-red-600 transition hover:border-red-400 hover:bg-red-100"
          >
            {c.terminate}
          </button>
        )}
        <Link
          href={`/${locale}/chats/${id}/report`}
          className="flex-1 rounded-lg border border-black/15 px-3 py-2.5 text-center text-sm font-semibold text-muted transition hover:border-black/30 hover:text-ink"
        >
          {c.report}
        </Link>
      </div>

      {/* Listing card */}
      {(topLine || metaLine) && (
        <Link
          href={`/${locale}/browse/${chat.listing_id}`}
          className="mb-3 block rounded-2xl border border-black/10 px-3.5 py-3 transition hover:border-black/20"
        >
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 break-words font-bold text-cobalt">{topLine || '—'}</span>
            <span aria-hidden="true" className="text-muted">›</span>
          </div>
          {role === 'seeker' && listing?.full_address && (
            <div className="mt-1 text-[0.85rem] text-ink">{listing.full_address}</div>
          )}
          {metaLine && <div className="mt-1 text-[0.85rem] text-ink">{metaLine}</div>}
          {availableLabel && <div className="mt-1 text-[0.8rem] text-muted">{c.available} {availableLabel}</div>}
        </Link>
      )}

      {/* Pending success — seeker reported "got the place", awaiting the lister */}
      {isActive && successReported && role === 'seeker' && (
        <div className="mb-3 rounded-xl border border-cobalt/30 bg-cobalt/5 p-4">
          <p className="mb-1 font-medium text-ink">{c.seekerReportedTitle}</p>
          <p className="text-xs text-muted">{c.seekerReportedBody}</p>
        </div>
      )}
      {isActive && successReported && role === 'lister' && (
        <div className="mb-3 rounded-xl border border-cobalt/30 bg-cobalt/5 p-4">
          <p className="mb-1 font-medium text-ink">{c.listerReportedTitle.replace('{name}', otherName)}</p>
          <p className="mb-3 text-xs text-muted">{c.listerReportedBody}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={closing}
              onClick={handleConfirmSuccess}
              className="rounded-lg bg-gradient-cobalt px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {c.confirmOffMarket}
            </button>
            <button
              type="button"
              disabled={closing}
              onClick={handleDeclineSuccess}
              className="rounded-lg border border-black/15 px-4 py-2 text-sm text-ink transition hover:border-black/30 disabled:opacity-60"
            >
              {c.decline}
            </button>
          </div>
        </div>
      )}

      {/* Lister close-request / seeker confirm */}
      {isActive && closeRequested && role === 'seeker' && (
        <div className="mb-3 rounded-xl border border-cobalt/30 bg-cobalt/5 p-4">
          <p className="mb-1 font-medium text-ink">{c.listerAskedClose}</p>
          <p className="mb-3 text-xs text-muted">{c.seekerConfirmCloseBody}</p>
          <button
            type="button"
            disabled={closing}
            onClick={handleConfirmClose}
            className="rounded-lg bg-gradient-cobalt px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {c.confirmClose}
          </button>
        </div>
      )}
      {isActive && closeRequested && role === 'lister' && (
        <div className="mb-3 rounded-xl border border-black/10 bg-white p-3 text-sm text-muted">
          {c.closeRequestedLister}
        </div>
      )}
      {listerCanRequest && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3">
          <p className="text-sm text-muted">{c.seekerIdle}</p>
          <button
            type="button"
            disabled={closing}
            onClick={handleRequestClose}
            className="shrink-0 rounded-lg border border-black/15 px-3 py-1.5 text-sm text-ink transition hover:border-black/30 disabled:opacity-60"
          >
            {c.requestClose}
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
              {c.howDidItGo}
            </h2>
            <p className="mb-5 text-sm text-muted">{c.terminateBody}</p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={closing}
                onClick={handleReportSuccess}
                className="w-full rounded-lg bg-gradient-cobalt px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {c.gotPlace}
              </button>
              <button
                type="button"
                disabled={closing}
                onClick={() => handleClose('closed_didnt_work')}
                className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-100 disabled:opacity-60"
              >
                {c.didntWork}
              </button>
              <button
                type="button"
                disabled={closing}
                onClick={() => setCloseOpen(false)}
                className="w-full rounded-lg px-4 py-2.5 text-sm text-muted transition hover:text-ink disabled:opacity-60"
              >
                {c.keepChatting}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opening reminder — the platform's message, styled distinctly from people's */}
      <div
        className="mb-3 rounded-2xl border p-3"
        style={{
          background: 'linear-gradient(135deg, rgba(27,77,228,.09), rgba(91,43,255,.07))',
          borderColor: 'rgba(27,77,228,.26)',
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <BrandTile size={16} className="rounded" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-cobalt">{c.reminderTitle}</span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {reminderBullets.map((b, i) => (
            <li key={i} className="relative pl-4 text-xs leading-relaxed text-ink/80">
              <span aria-hidden="true" className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-cobalt" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* Thread */}
      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{c.empty}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myUserId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2 text-sm ${
                    mine
                      ? 'rounded-[16px_16px_5px_16px] bg-gradient-cobalt text-white'
                      : 'rounded-[16px_16px_16px_5px] border border-black/10 bg-paper text-ink'
                  }`}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 text-[10px] text-muted">{fmtTime(m.created_at)}</span>
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
        <form onSubmit={handleSend} className="mt-2 flex items-center gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={c.inputPlaceholder}
            className="flex-1 rounded-full border border-black/15 bg-paper px-4 py-3 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          />
          <button
            type="submit"
            aria-label={c.send}
            disabled={sending || !body.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-cobalt text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M12 20V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      ) : (
        <div className="mt-2 rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-center text-sm text-muted">
          <p className="mb-2">{closedLabel}</p>
          <Link href={`/${locale}/chats/${id}/rate`} className="text-cobalt hover:underline">
            {c.rate}
          </Link>
        </div>
      )}
    </main>
  );
}
