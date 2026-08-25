'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

// Report a member/listing. The reason list depends on who's reporting: a renter
// reporting a listing/lister vs. a lister reporting a seeker. Labels come from
// the `report.reasons` dictionary.
const RENTER_REASON_KEYS = ['unresponsive', 'unavailable', 'inaccurate', 'fraudulent', 'something_else'];
const LISTER_REASON_KEYS = ['unresponsive', 'not_serious', 'inappropriate', 'fraudulent', 'something_else'];

export default function ReportView({
  locale,
  chatId,
  listingId,
  role = 'seeker',
}: {
  locale: Locale;
  chatId?: string;
  listingId?: string;
  role?: 'lister' | 'seeker';
}) {
  const rp = getDictionary(locale).report;
  const reasonLabels = rp.reasons as Record<string, string>;
  const reasonKeys = role === 'lister' ? LISTER_REASON_KEYS : RENTER_REASON_KEYS;

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
        <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Peredai</p>
        <h1 className="mb-2 font-display text-2xl text-ink">{rp.doneTitle}</h1>
        <p className="mb-8 text-sm text-muted">{rp.doneBody}</p>
        <Link href={backHref} className="text-sm text-cobalt hover:underline">
          {rp.back}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Peredai</p>
      <h1 className="mb-2 font-display text-2xl text-ink">{rp.title}</h1>
      <p className="mb-6 text-sm text-muted">{rp.subtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          {reasonKeys.map((key) => (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                reason === key ? 'border-cobalt bg-cobalt/10 text-ink' : 'border-black/15 text-muted hover:border-black/30'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={key}
                checked={reason === key}
                onChange={() => setReason(key)}
                className="h-4 w-4 accent-cobalt"
              />
              {reasonLabels[key]}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm text-muted">
          {rp.detailLabel}
          <textarea
            required
            rows={4}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={rp.detailPlaceholder}
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          />
        </label>

        {chatId && <p className="text-xs leading-relaxed text-muted">{rp.consent}</p>}

        {phase === 'error' && (
          <p role="alert" className="text-sm text-red-600">
            {rp.errorGeneric.replace('{error}', error)}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!reason || !detail.trim() || phase === 'submitting'}
            className="rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {phase === 'submitting' ? rp.submitting : rp.submit}
          </button>
          <Link href={backHref} className="text-sm text-muted hover:text-ink">
            {rp.cancel}
          </Link>
        </div>
      </form>
    </main>
  );
}
