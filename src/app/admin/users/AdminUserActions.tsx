'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminUserActions({ userId, shadowBanned }: { userId: string; shadowBanned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function act(action: 'ban' | 'unban' | 'refund') {
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/admin/users/${userId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(`error: ${d.error ?? 'failed'}`);
      return;
    }
    if (action === 'refund') setMsg('+1 credit granted');
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {shadowBanned ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('unban')}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-gold/60 transition hover:brightness-110 disabled:opacity-60"
        >
          Unban
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('ban')}
          className="rounded-lg border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-400 ring-1 ring-inset ring-red-500/20 transition hover:bg-red-500/10 disabled:opacity-60"
        >
          Shadow-ban
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => act('refund')}
        className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-medium text-paper ring-1 ring-inset ring-white/10 transition hover:border-white/50 disabled:opacity-60"
      >
        Refund +1 credit
      </button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
