'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(action: 'confirm' | 'dismiss') {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/reports/${reportId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
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
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => act('confirm')}
        className="rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-ink ring-1 ring-inset ring-gold/60 transition hover:brightness-110 disabled:opacity-60"
      >
        Confirm + refund
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => act('dismiss')}
        className="rounded-lg border border-white/25 px-6 py-3 text-sm font-medium text-paper ring-1 ring-inset ring-white/10 transition hover:border-white/50 hover:ring-white/20 disabled:opacity-60"
      >
        Dismiss
      </button>
      {error && <span className="text-sm text-red-400">({error})</span>}
    </div>
  );
}
