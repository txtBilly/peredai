'use client';

import { useEffect, useRef, useState } from 'react';

// Polls the SBP payment status while the seeker has the QR on screen. When the
// server reports the payment granted, it forwards to the success page. The grant
// itself happens server-side (idempotent) — this only drives the UI and the
// redirect.
type Phase = 'waiting' | 'granted' | 'rejected';

export default function SbpQrPoller({
  qrc,
  next,
  locale,
}: {
  qrc: string;
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
        const res = await fetch(`/api/checkout/sbp-status?qrc=${encodeURIComponent(qrc)}`, {
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
      timer = setTimeout(tick, 3000);
    }

    timer = setTimeout(tick, 3000);
    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [qrc, next]);

  const t = {
    waiting: locale === 'en' ? 'Waiting for payment…' : 'Ожидаем оплату…',
    granted: locale === 'en' ? 'Paid — redirecting…' : 'Оплачено — переходим…',
    rejected:
      locale === 'en'
        ? 'Payment was declined. You can try again.'
        : 'Платёж отклонён. Можно попробовать снова.',
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
