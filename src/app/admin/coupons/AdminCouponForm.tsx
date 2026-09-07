'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ERRORS: Record<string, string> = {
  code_required: 'Укажите код.',
  invalid_kind: 'Выберите тип.',
  code_exists: 'Такой код уже существует.',
  create_failed: 'Не удалось создать промокод.',
  forbidden: 'Нет доступа.',
};

export default function AdminCouponForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<'percent' | 'fixed' | 'free'>('percent');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: fd.get('code'),
        kind,
        value: fd.get('value'),
        bonus_credits: fd.get('bonus_credits'),
        max_redemptions: fd.get('max_redemptions'),
        expires_at: fd.get('expires_at'),
        note: fd.get('note'),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(ERRORS[d.error] ?? 'Ошибка.');
      return;
    }
    (e.target as HTMLFormElement).reset();
    setKind('percent');
    setOpen(false);
    router.refresh();
  }

  const field =
    'rounded-lg border border-white/15 bg-ink/40 px-3 py-2 text-paper placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-gold';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
      >
        + Новый промокод
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Код
          <input name="code" required autoComplete="off" placeholder="НАПРИМЕР SALE20" className={`${field} uppercase`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Тип
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'percent' | 'fixed' | 'free')}
            className={field}
          >
            <option value="percent">Скидка, %</option>
            <option value="fixed">Скидка, ₽</option>
            <option value="free">Бесплатно (100%)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {kind === 'percent' ? 'Значение, %' : kind === 'fixed' ? 'Значение, ₽' : 'Значение (не используется)'}
          <input
            name="value"
            type="number"
            min={0}
            max={kind === 'percent' ? 100 : undefined}
            defaultValue={0}
            disabled={kind === 'free'}
            className={`${field} disabled:opacity-40`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Бонусные токены
          <input name="bonus_credits" type="number" min={0} defaultValue={0} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Макс. использований (пусто = без лимита)
          <input name="max_redemptions" type="number" min={1} placeholder="∞" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Действует до (пусто = бессрочно)
          <input name="expires_at" type="date" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2 lg:col-span-3">
          Заметка
          <input name="note" autoComplete="off" placeholder="для чего этот промокод" className={field} />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Создаём…' : 'Создать'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
          className="text-sm text-muted hover:text-paper"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
