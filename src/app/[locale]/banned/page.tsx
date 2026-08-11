import { notFound } from 'next/navigation';
import { isLocale, getDictionary } from '@/i18n/config';

// Full-ban notice. Deliberately does NOT call requireUser/redirectIfBanned
// (that would loop). A fully-banned member lands here and can only sign out.
export default function BannedPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const b = getDictionary(params.locale).banned;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <p className="mb-4 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
        <span className="text-2xl text-red-400">⛔</span>
      </div>
      <h1 className="mb-2 font-display text-2xl text-paper">{b.title}</h1>
      <p className="mb-8 text-sm text-muted">{b.body}</p>
      <form action="/api/auth/signout" method="POST" className="w-full">
        <button
          type="submit"
          className="w-full rounded-lg border border-white/15 px-5 py-3 text-sm text-muted transition hover:border-white/30 hover:text-paper"
        >
          {b.signOut}
        </button>
      </form>
    </main>
  );
}
