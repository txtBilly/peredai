'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Action = 'ban' | 'unban' | 'refund' | 'clear_review' | 'full_ban' | 'lift_full_ban';

export default function AdminUserActions({
  userId,
  shadowBanned,
  duplicateReview = false,
  fullBanned = false,
}: {
  userId: string;
  shadowBanned: boolean;
  duplicateReview?: boolean;
  fullBanned?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const CONFIRM: Record<Action, string> = {
    ban: 'Shadow-ban this member? They’ll be hidden and blocked from listing/connecting — silently.',
    unban: 'Remove the shadow-ban on this member?',
    refund: 'Grant this member +1 contact credit?',
    clear_review: 'Clear the duplicate-review flag? This member will be able to publish listings.',
    full_ban: 'Fully ban this member? They’ll be locked out of the platform entirely.',
    lift_full_ban: 'Lift the full ban on this member?',
  };

  async function act(action: Action) {
    if (!window.confirm(CONFIRM[action])) return;
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
      {duplicateReview && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('clear_review')}
          className="rounded-lg border border-amber-400/40 px-5 py-2.5 text-sm font-medium text-amber-300 ring-1 ring-inset ring-amber-400/20 transition hover:bg-amber-400/10 disabled:opacity-60"
        >
          Clear duplicate review
        </button>
      )}
      {fullBanned ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('lift_full_ban')}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-gold/60 transition hover:brightness-110 disabled:opacity-60"
        >
          Lift full ban
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('full_ban')}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/20 disabled:opacity-60"
        >
          Full ban
        </button>
      )}
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
