'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

type Channel = 'email' | 'sms' | 'push';
type EventKey = 'bid_accepted' | 'chat_message' | 'listing_freed' | 'expiry_warn';

const EVENT_KEYS: EventKey[] = ['bid_accepted', 'chat_message', 'listing_freed', 'expiry_warn'];
const CHANNELS: Channel[] = ['email', 'sms', 'push'];

type Prefs = Record<EventKey, Channel[]>;

const DEFAULTS: Prefs = {
  bid_accepted: ['sms', 'email'],
  chat_message: ['email'],
  listing_freed: ['push', 'email'],
  expiry_warn: ['sms', 'push', 'email'],
};

// Email is an always-on channel that can't be turned off. Guarantee it's present
// in every event so the (disabled) email checkboxes render checked and any saved
// row also carries it.
function withEmailAlwaysOn(prefs: Prefs): Prefs {
  const out = {} as Prefs;
  (Object.keys(prefs) as EventKey[]).forEach((k) => {
    out[k] = prefs[k].includes('email') ? prefs[k] : [...prefs[k], 'email'];
  });
  return out;
}

export default function NotificationsPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const n = d.notifications;
  const common = d.common;
  const router = useRouter();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push(`/${locale}/signin`); return; }
      supabase
        .from('notification_prefs')
        .select('bid_accepted, chat_message, listing_freed, expiry_warn')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setPrefs(withEmailAlwaysOn(data as Prefs));
          setLoading(false);
        });
    });
  }, [locale, router]);

  function toggleChannel(event: EventKey, channel: Channel) {
    if (channel === 'email') return; // email is always on — not toggleable
    setPrefs((cur) => {
      const current = cur[event];
      const next = current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      return { ...cur, [event]: next };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('saving');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push(`/${locale}/signin`); return; }

    const { error: updateError } = await supabase
      .from('notification_prefs')
      .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' });

    if (updateError) {
      setError(n.errorGeneric);
      setStatus('idle');
      return;
    }
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 3000);
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cobalt border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <p className="mb-1 text-sm uppercase tracking-wide text-cobalt">Peredai</p>
      <div className="mb-8 flex items-center gap-3">
        <Link href={`/${locale}/account`} className="text-muted hover:text-ink" aria-label={common.back}>‹</Link>
        <h1 className="font-display text-3xl text-ink">{n.title}</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
        {/* Header row */}
        <div className="mb-1 grid grid-cols-[1fr_repeat(3,3rem)] items-center gap-2 px-4 text-xs uppercase tracking-wide text-muted">
          <span />
          {CHANNELS.map((c) => (
            <span key={c} className="text-center">{n[c]}</span>
          ))}
        </div>

        {EVENT_KEYS.map((eventKey) => (
          <div
            key={eventKey}
            className="grid grid-cols-[1fr_repeat(3,3rem)] items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3"
          >
            <span className="text-sm text-ink">{n[eventKey]}</span>
            {CHANNELS.map((channel) => {
              const isEmail = channel === 'email';
              const checked = isEmail || prefs[eventKey].includes(channel);
              const id = `${eventKey}-${channel}`;
              return (
                <div key={channel} className="flex justify-center">
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    disabled={isEmail}
                    onChange={() => toggleChannel(eventKey, channel)}
                    aria-label={`${n[eventKey]} via ${n[channel]}${isEmail ? ' (always on)' : ''}`}
                    className={`h-4 w-4 accent-cobalt ${isEmail ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  />
                </div>
              );
            })}
          </div>
        ))}

        <p className="mt-2 px-1 text-xs text-muted">
          Email notifications are always on and can’t be turned off.
        </p>

        {error && (
          <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {status === 'saved' && (
          <p role="status" className="mt-2 rounded-lg border border-leaf/30 bg-leaf/10 px-3 py-2 text-sm text-leaf">
            {n.saved}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'saving'}
          className="mt-4 w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {status === 'saving' ? n.saving : n.save}
        </button>
      </form>
    </main>
  );
}
