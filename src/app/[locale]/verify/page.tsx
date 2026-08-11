'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

// Lister identity verification via a real KYC provider (Stripe Identity).
// Clicking "Start" creates a hosted verification session and redirects to the
// provider, which captures the ID document + selfie. The provider's webhook
// writes the result, so on return we just re-read the status. Seekers don't use
// this — they verify via the background check at Connect.
type Phase = 'loading' | 'unverified' | 'pending' | 'verified' | 'failed';

export default function VerifyPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string; return?: string };
}) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const v = d.verify;
  const router = useRouter();
  const nextPath = `/${locale}/${searchParams?.next?.replace(/^\/+/, '') || 'account'}`;
  const returned = searchParams?.return === '1';

  const [phase, setPhase] = useState<Phase>('loading');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  // Re-reads the profile's verification status. Used on mount and when the user
  // returns from the provider (the webhook may still be finalizing).
  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace(`/${locale}/signin`);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('verification_status')
      .eq('id', user.id)
      .single();
    const status = data?.verification_status;
    if (status === 'verified') setPhase('verified');
    else if (status === 'failed') setPhase('failed');
    else if (status === 'pending' || returned) setPhase('pending');
    else setPhase('unverified');
  }, [locale, router, returned]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startVerify() {
    setError('');
    setStarting(true);
    try {
      const res = await fetch('/api/identity/start', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(v.errorGeneric);
        setStarting(false);
        return;
      }
      // Real provider: redirect to the hosted flow.
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      // Mock: processed inline.
      setStarting(false);
      if (data.status === 'verified') setPhase('verified');
      else if (data.status === 'pending') setPhase('pending');
      else setPhase('failed');
    } catch {
      setError(v.errorGeneric);
      setStarting(false);
    }
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </main>
    );
  }

  if (phase === 'verified') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        <p className="mb-4 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sage/20">
          <span className="text-2xl text-sage">✓</span>
        </div>
        <h1 className="mb-2 font-display text-3xl text-paper">{v.successTitle}</h1>
        <VerifiedBadge className="mb-4" />
        <p className="mb-8 text-sm text-muted">{v.successBody}</p>
        <button
          onClick={() => router.push(nextPath)}
          className="w-full rounded-lg bg-gold px-5 py-3 font-medium text-ink transition hover:brightness-110"
        >
          {v.continueCta}
        </button>
      </main>
    );
  }

  if (phase === 'pending') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        <p className="mb-4 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
        <div className="mb-6 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        <h1 className="mb-2 font-display text-2xl text-paper">{v.pendingTitle}</h1>
        <p className="mb-8 text-sm text-muted">{v.pendingBody}</p>
        <button
          onClick={refresh}
          className="w-full rounded-lg border border-white/15 px-5 py-3 text-sm text-paper transition hover:border-white/30"
        >
          {v.refreshCta}
        </button>
      </main>
    );
  }

  if (phase === 'failed') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        <p className="mb-4 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
          <span className="text-2xl text-red-400">✗</span>
        </div>
        <h1 className="mb-2 font-display text-2xl text-paper">{v.failedTitle}</h1>
        <p className="mb-8 text-sm text-muted">{v.failedBody}</p>
        <button
          onClick={startVerify}
          disabled={starting}
          className="w-full rounded-lg bg-gold px-5 py-3 font-medium text-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {starting ? v.starting : v.retryCta}
        </button>
      </main>
    );
  }

  // unverified
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <p className="mb-4 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
      <h1 className="mb-2 font-display text-3xl text-paper">{v.title}</h1>
      <p className="mb-8 text-sm text-muted">{v.subtitle}</p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        onClick={startVerify}
        disabled={starting}
        className="w-full rounded-lg bg-gold px-5 py-3 font-medium text-ink transition hover:brightness-110 disabled:opacity-50"
      >
        {starting ? v.starting : v.startCta}
      </button>
      <p className="mt-4 text-center text-xs text-muted">
        Your ID is handled by our verification partner and is never shown to other members.
      </p>
    </main>
  );
}
