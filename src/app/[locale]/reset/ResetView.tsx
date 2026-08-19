'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

export default function ResetView({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('submitting');

    const supabase = createClient();
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/reset/confirm`
        : `/${locale}/reset/confirm`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      setStatus('idle');
      setError(d.auth.errorGeneric);
      return;
    }

    setStatus('sent');
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <h1 className="mb-2 font-display text-3xl text-ink">{d.auth.resetTitle}</h1>
      <p className="mb-8 text-sm text-muted">{d.auth.resetSubtitle}</p>

      {status === 'sent' ? (
        <p className="rounded-lg border border-leaf/40 bg-leaf/10 px-4 py-3 text-sm text-leaf">
          {d.auth.resetSent}
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-muted">
              {d.auth.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={d.auth.emailPlaceholder}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {status === 'submitting' ? d.auth.resetSubmitting : d.auth.resetSubmit}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        <Link href={`/${locale}/signin`} className="text-ink underline-offset-2 hover:underline">
          {d.auth.signInLink}
        </Link>
      </p>
    </main>
  );
}
