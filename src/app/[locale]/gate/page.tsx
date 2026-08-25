import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';

// Pre-launch splash. Only ever shown when SITE_PASSCODE is set and the visitor
// hasn't unlocked yet (enforced in middleware). Submits to /api/gate, which
// sets the unlock cookie and redirects to `next`.
export default function GatePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string; error?: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const next = searchParams?.next && searchParams.next.startsWith('/') ? searchParams.next : `/${params.locale}`;
  const error = searchParams?.error === '1';

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16 text-center">
      <p className="mb-3 text-sm uppercase tracking-[0.2em] text-cobalt">Peredai</p>
      <h1 className="mb-2 font-display text-3xl text-ink">Invite only, for now</h1>
      <p className="mb-8 text-sm text-muted">
        Peredai is in a private preview. Enter your access code to continue.
      </p>

      <form action="/api/gate" method="POST" className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          type="password"
          name="code"
          autoFocus
          required
          placeholder="Access code"
          aria-label="Access code"
          className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-center text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            That code isn’t right. Try again.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110"
        >
          Enter
        </button>
      </form>
    </main>
  );
}
