'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Action = 'ban' | 'unban' | 'refund' | 'clear_review' | 'full_ban' | 'lift_full_ban';

export default function AdminUserActions({
  userId,
  shadowBanned,
  duplicateReview = false,
  fullBanned = false,
  balance = 0,
}: {
  userId: string;
  shadowBanned: boolean;
  duplicateReview?: boolean;
  fullBanned?: boolean;
  balance?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [voidN, setVoidN] = useState(Math.max(1, balance));

  async function voidTokens() {
    const n = Math.min(Math.max(1, Math.floor(voidN)), balance);
    if (
      !window.confirm(
        `Аннулировать ${n} токен(ов) у пользователя? Используйте это ПОСЛЕ возврата денег через банк. Текущий баланс: ${balance}.`
      )
    )
      return;
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/admin/users/${userId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'void_tokens', amount: n }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(`error: ${d.error ?? 'failed'}`);
      return;
    }
    setMsg(`Аннулировано ${n} токен(ов)`);
    router.refresh();
  }

  const CONFIRM: Record<Action, string> = {
    ban: 'Выдать теневой бан? Пользователь будет скрыт и не сможет размещать объявления и открывать диалоги — незаметно для него.',
    unban: 'Снять теневой бан с пользователя?',
    refund: 'Начислить пользователю +1 токен?',
    clear_review: 'Снять пометку дубликата? Пользователь сможет публиковать объявления.',
    full_ban: 'Полностью заблокировать пользователя? Доступ к платформе будет закрыт.',
    lift_full_ban: 'Снять полную блокировку с пользователя?',
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
    if (action === 'refund') setMsg('+1 токен начислен');
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
          Снять теневой бан
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('ban')}
          className="rounded-lg border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-400 ring-1 ring-inset ring-red-500/20 transition hover:bg-red-500/10 disabled:opacity-60"
        >
          Теневой бан
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => act('refund')}
        className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-medium text-paper ring-1 ring-inset ring-white/10 transition hover:border-white/50 disabled:opacity-60"
      >
        Вернуть +1 токен
      </button>

      {balance > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5">
          <span className="text-xs text-muted">Аннулировать</span>
          <input
            type="number"
            min={1}
            max={balance}
            value={voidN}
            onChange={(e) => setVoidN(Number(e.target.value))}
            className="w-14 rounded-md border border-white/20 bg-ink/40 px-2 py-1 text-sm text-paper outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          />
          <span className="text-xs text-muted">из {balance}</span>
          <button
            type="button"
            disabled={busy}
            onClick={voidTokens}
            className="rounded-md border border-red-500/40 px-3 py-1 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
          >
            Списать токен(ы)
          </button>
        </div>
      ) : (
        <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted/70">
          Аннулирование недоступно — 0 токенов (возврат не требуется)
        </span>
      )}

      {duplicateReview && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('clear_review')}
          className="rounded-lg border border-amber-400/40 px-5 py-2.5 text-sm font-medium text-amber-300 ring-1 ring-inset ring-amber-400/20 transition hover:bg-amber-400/10 disabled:opacity-60"
        >
          Снять пометку дубликата
        </button>
      )}
      {fullBanned ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('lift_full_ban')}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-gold/60 transition hover:brightness-110 disabled:opacity-60"
        >
          Снять полную блокировку
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => act('full_ban')}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/20 disabled:opacity-60"
        >
          Полная блокировка
        </button>
      )}
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
