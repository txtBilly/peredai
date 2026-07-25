'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';

// Post-chat rating. Copy is functional; final wording + i18n land in the copy
// sweep. Two confirmed bad ratings suppression is advisory-only per decision.
export default function RateView({ locale, chatId }: { locale: Locale; chatId: string }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<'form' | 'submitting' | 'done' | 'error'>('form');
  const [error, setError] = useState('');

  const backHref = `/${locale}/chats/${chatId}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1) return;
    setPhase('submitting');
    setError('');
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, stars, body: note }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'already_rated') {
          setPhase('done');
          return;
        }
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
        <h1 className="mb-2 font-display text-2xl text-paper">Thanks for the feedback</h1>
        <p className="mb-8 text-sm text-muted">Your rating helps keep the community trustworthy.</p>
        <Link href={backHref} className="text-sm text-gold hover:underline">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <p className="mb-2 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
      <h1 className="mb-2 font-display text-2xl text-paper">How was it?</h1>
      <p className="mb-6 text-sm text-muted">Rate your experience. Two confirmed bad reports lead to removal.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex gap-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className={`text-3xl transition ${(hover || stars) >= n ? 'text-gold' : 'text-white/20'}`}
            >
              ★
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Add a note (optional)
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-lg border border-white/15 bg-ink/40 px-3 py-2 text-paper placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-gold"
          />
        </label>

        {phase === 'error' && (
          <p role="alert" className="text-sm text-red-400">
            Something went wrong ({error}). Please try again.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={stars < 1 || phase === 'submitting'}
            className="rounded-lg bg-gold px-5 py-3 font-medium text-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {phase === 'submitting' ? 'Submitting…' : 'Submit rating'}
          </button>
          <Link href={backHref} className="text-sm text-muted hover:text-paper">
            Skip
          </Link>
        </div>
      </form>
    </main>
  );
}
