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

export default function VerifyView({
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
  const [checking, setChecking] = useState(false);
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
    if (status === 'verified') {
      // Refresh the JWT so app_metadata.verified is present for the middleware gate.
      try {
        await supabase.auth.refreshSession();
      } catch {
        /* non-fatal */
      }
      setPhase('verified');
    } else if (status === 'failed') setPhase('failed');
    else if (status === 'pending' || returned) setPhase('pending');
    else setPhase('unverified');
  }, [locale, router, returned]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Coming back from the hosted flow (incl. the browser's back-forward cache)
  // can restore this page with `starting` still true, leaving the buttons stuck.
  // Reset the transient flags and re-read status whenever the page is shown.
  useEffect(() => {
    const onShow = () => {
      setStarting(false);
      setChecking(false);
      setError('');
      refresh();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [refresh]);

  async function handleCheck() {
    setChecking(true);
    await refresh();
    setChecking(false);
  }

  async function startVerify(provider: string) {
    setError('');
    setStarting(true);
    try {
      const res = await fetch('/api/identity/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(v.errorGeneric);
        setStarting(false);
        return;
      }
      // Bank provider: redirect to the hosted flow.
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      // Mock: processed inline.
      setStarting(false);
      if (data.status === 'verified') {
        // Refresh the session so the new access token carries app_metadata.verified.
        // Without this the mandatory-verify middleware keeps bouncing the
        // just-verified user (stale JWT) and every CTA looks unresponsive.
        try {
          await createClient().auth.refreshSession();
        } catch {
          /* non-fatal */
        }
        setPhase('verified');
      } else if (data.status === 'pending') setPhase('pending');
      else setPhase('failed');
    } catch {
      setError(v.errorGeneric);
      setStarting(false);
    }
  }

  // Which providers to offer (NEXT_PUBLIC_IDENTITY_PROVIDERS, e.g. "sber,tid" or "mock").
  const providers = (process.env.NEXT_PUBLIC_IDENTITY_PROVIDERS ?? 'mock')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const providerLabel = (p: string) =>
    p === 'sber' ? v.providerSber : p === 'tid' ? v.providerTid : p === 'mock' ? v.providerMock : p;
  const providerButtons = (
    <div className="flex w-full flex-col gap-2.5">
      {providers.map((p) => (
        <button
          key={p}
          onClick={() => startVerify(p)}
          disabled={starting || checking}
          className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {starting ? v.starting : providerLabel(p)}
        </button>
      ))}
    </div>
  );

  // Shared with every resolved phase so the screens stay consistent with the
  // rest of the app (header comes from the server wrapper; this adds the Back
  // control and positions content in the upper area like the intro screen).
  const backBar = (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => router.back()}
        className="-ml-1 flex items-center gap-1 rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold text-ink transition hover:border-black/40 hover:bg-black/[0.03]"
      >
        <span aria-hidden="true" className="text-base leading-none">‹</span> {v.backCta}
      </button>
    </div>
  );

  if (phase === 'loading') {
    return (
      <main className="mx-auto flex min-h-[40vh] max-w-md items-center justify-center px-5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cobalt border-t-transparent" />
      </main>
    );
  }

  if (phase === 'verified') {
    return (
      <main className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-5 py-10 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-leaf/20">
          <span className="text-2xl text-leaf">✓</span>
        </div>
        <h1 className="mb-2 font-display text-3xl text-ink">{v.successTitle}</h1>
        <VerifiedBadge className="mb-4" />
        <p className="mb-8 text-sm text-muted">{v.successBody}</p>
        <button
          onClick={() => window.location.assign(nextPath)}
          className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110"
        >
          {v.continueCta}
        </button>
      </main>
    );
  }

  if (phase === 'pending') {
    return (
      <main className="mx-auto flex min-h-[40vh] max-w-md flex-col px-5 py-6">
        {backBar}
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <div className="mb-6 h-8 w-8 animate-spin rounded-full border-2 border-cobalt border-t-transparent" />
        <h1 className="mb-2 font-display text-2xl font-bold text-ink">{v.pendingTitle}</h1>
        <p className="mb-8 text-sm text-muted">{v.pendingBody}</p>
        <div className="flex w-full flex-col gap-2.5">
          <button
            onClick={handleCheck}
            disabled={checking || starting}
            className="w-full rounded-lg border border-black/15 px-5 py-3 text-sm text-ink transition hover:border-black/30 disabled:opacity-50"
          >
            {checking ? v.checkingCta : v.refreshCta}
          </button>
          {providerButtons}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
        </div>
      </main>
    );
  }

  if (phase === 'failed') {
    return (
      <main className="mx-auto flex min-h-[40vh] max-w-md flex-col px-5 py-6">
        {backBar}
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
            <span className="text-2xl text-red-600">✗</span>
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-ink">{v.failedTitle}</h1>
          <p className="mb-8 text-sm text-muted">{v.failedBody}</p>
          {providerButtons}
        </div>
      </main>
    );
  }

  // unverified
  return (
    <main className="mx-auto flex min-h-[40vh] max-w-md flex-col px-5 py-6">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-1 flex items-center gap-1 rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold text-ink transition hover:border-black/40 hover:bg-black/[0.03]"
        >
          <span aria-hidden="true" className="text-base leading-none">‹</span> {v.backCta}
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink">
        Подтвердите личность, чтобы полноценно пользоваться платформой.
      </h1>
      <p className="mb-3 text-justify text-sm text-muted [hyphens:auto]">
        Мы заботимся о безопасности и надёжности нашего сообщества арендаторов, поэтому хотим
        знать, кому мы открываем свои двери.
      </p>
      <p className="mb-3 text-justify text-sm text-muted [hyphens:auto]">
        Единоразовое подтверждение личности через Ваш банк займёт менее минуты.
      </p>
      <p className="mb-3 text-justify text-sm text-muted [hyphens:auto]">
        Ваше полное имя будет видно только проверенному участнику, заинтересованному именно
        в Вашем объявлении.
      </p>
      <p className="mb-8 text-sm text-muted">Регистрация полностью бесплатная.</p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {providerButtons}
      </div>
    </main>
  );
}
