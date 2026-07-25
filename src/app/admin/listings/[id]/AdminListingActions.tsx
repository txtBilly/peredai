'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminListingActions({ listingId, status }: { listingId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function moderate(newStatus: 'active' | 'suspended') {
    const message =
      newStatus === 'suspended'
        ? 'Hide (suspend) this listing? It will be removed from Browse.'
        : 'Restore this listing to active?';
    if (!window.confirm(message)) return;
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/listings/${listingId}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'error');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {status !== 'suspended' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => moderate('suspended')}
          className="rounded-lg border border-amber-400/40 px-6 py-3 text-sm font-medium text-amber-300 ring-1 ring-inset ring-amber-400/20 transition hover:bg-amber-500/10 disabled:opacity-60"
        >
          Hide (suspend)
        </button>
      )}
      {status !== 'active' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => moderate('active')}
          className="rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-ink ring-1 ring-inset ring-gold/60 transition hover:brightness-110 disabled:opacity-60"
        >
          Restore (active)
        </button>
      )}
      {error && <span className="text-sm text-red-400">({error})</span>}
    </div>
  );
}
