'use client';

import { useEffect, useRef, useState } from 'react';

// Polls the acquiring payment status after the buyer returns from Tochka's
// hosted payment page. On granted it forwards to the success page. The grant
// itself is server-side (idempotent); this only drives the UI + redirect.
type Phase = 'waiting' | 'granted' | 'rejected';

export default function AcquiringReturnPoller({
  refId,
  next,
  locale,
}: {
  refId: string;
  next: string;
  locale: 'ru' | 'en';
}) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const stopped = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      if (stopped.current) return;
      try {
        const res = await fetch(`/api/checkout/acquiring-status?ref=${encodeURIComponent(refId)}`, {
          cache: 'no-store',
        });
        const data = (await res.json()) as { status?: string };
        if (data.status === 'granted') {
          stopped.current = true;
          setPhase('granted');
          window.location.href = next;
          return;
        }
        if (data.status === 'rejected') {
          stopped.current = true;
          setPhase('rejected');
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      timer = setTimeout(tick, 2500);
    }
    timer = setTimeout(tick, 1500);
    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [refId, next]);

  const t = {
    waiting: locale === 'en' ? 'Waiting for confirmation…' : 'Ожидаем подтверждение…',
    granted: locale === 'en' ? 'Done — redirecting…' : 'Готово — переходим…',
    rejected:
      locale === 'en'
        ? 'Payment was not completed. You can try again.'
        : 'Оплата не завершена. Можно попробовать снова.',
  }[phase];

  return (
    <p
      className={`mt-5 flex items-center justify-center gap-2 text-sm ${
        phase === 'rejected' ? 'text-red-600' : 'text-ink/60'
      }`}
      role="status"
      aria-live="polite"
    >
      {phase === 'waiting' && (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cobalt border-t-transparent"
          aria-hidden="true"
        />
      )}
      {t}
    </p>
  );
}
