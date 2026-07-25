'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';

// Report a member/listing. Copy is functional (the intro line is the locked
// decision); final wording + i18n land in the copy sweep.
const REASONS: { value: string; label: string }[] = [
  { value: 'unresponsive', label: 'Unresponsive' },
  { value: 'unavailable', label: 'Apartment unavailable' },
  { value: 'inaccurate', label: 'Inaccurate listing' },
  { value: 'fraudulent', label: 'Fraudulent / scam' },
  { value: 'something_else', label: 'Something else' },
];

export default function ReportView({
  locale,
  chatId,
  listingId,
}: {
  locale: Locale;
  chatId?: string;
  listingId?: string;
}) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [phase, setPhase] = useState<'form' | 'submitting' | 'done' | 'error'>('form');
  const [error, setError] = useState('');

  const backHref = chatId
    ? `/${locale}/chats/${chatId}`
    : listingId
      ? `/${locale}/browse/${listingId}`
      : `/${locale}/browse`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || !detail.trim()) return;
    setPhase('submitting');
    setError('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, detail, chatId, listingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'error');
        setPhase('error');
        return;
      }
      setPhase('done');
    } catch {
      setError('network');
      setPhase('error');
    }
  }

  if (phase === 'done') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        <p className="mb-2 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
        <h1 className="mb-2 font-display text-2xl text-paper">Report received</h1>
        <p className="mb-8 text-sm text-muted">
          Thanks — our team will review it. Messages are never deleted, so we can see exactly what happened.
        </p>
        <Link href={backHref} className="text-sm text-gold hover:underline">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <p className="mb-2 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
      <h1 className="mb-2 font-display text-2xl text-paper">Report</h1>
      <p className="mb-6 text-sm text-muted">
        Ten2Ten community is built on trust and safety. Tell us more. We got you.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                reason === r.value ? 'border-gold bg-gold/10 text-paper' : 'border-white/15 text-muted hover:border-white/30'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="h-4 w-4 accent-gold"
              />
              {r.label}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Tell us what happened (required)
          <textarea
            required
            rows={4}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="A few details help our team review this fairly."
            className="rounded-lg border border-white/15 bg-ink/40 px-3 py-2 text-paper placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-gold"
          />
        </label>

        {chatId && (
          <p className="text-xs leading-relaxed text-muted">
            By submitting, you consent to sharing this conversation with the Ten2Ten team so we can review it fairly.
          </p>
        )}

        {phase === 'error' && (
          <p role="alert" className="text-sm text-red-400">
            Something went wrong ({error}). Please try again.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!reason || !detail.trim() || phase === 'submitting'}
            className="rounded-lg bg-gold px-5 py-3 font-medium text-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {phase === 'submitting' ? 'Submitting…' : 'Submit report'}
          </button>
          <Link href={backHref} className="text-sm text-muted hover:text-paper">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
