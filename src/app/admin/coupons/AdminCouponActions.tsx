'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminCouponActions({
  couponId,
  active,
  redeemed,
}: {
  couponId: string;
  active: boolean;
  redeemed: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: 'activate' | 'deactivate' | 'delete') {
    if (action === 'delete') {
      const msg =
        redeemed > 0
          ? `Удалить промокод? У него ${redeemed} использований — история будет потеряна. Лучше отключить.`
          : 'Удалить промокод?';
      if (!window.confirm(msg)) return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/coupons/${couponId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => act(active ? 'deactivate' : 'activate')}
        className="text-xs font-medium text-gold hover:underline disabled:opacity-50"
      >
        {active ? 'Отключить' : 'Включить'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => act('delete')}
        className="text-xs font-medium text-red-400 hover:underline disabled:opacity-50"
      >
        Удалить
      </button>
    </div>
  );
}
