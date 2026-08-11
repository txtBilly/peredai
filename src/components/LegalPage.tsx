import Link from 'next/link';
import type { Locale } from '@/i18n/config';

// Shell for the legal pages. Content is placeholder — final Terms/Privacy/Safety
// copy is a launch blocker pending counsel sign-off.
export default function LegalPage({
  locale,
  title,
  children,
}: {
  locale: Locale;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <Link href={`/${locale}/welcome`} className="text-sm text-muted hover:text-paper">
        ‹ Back
      </Link>
      <h1 className="mb-2 mt-4 font-display text-3xl text-paper">{title}</h1>
      <p className="mb-8 text-xs text-amber-300/80">
        Draft placeholder — final copy is pending legal review before public launch.
      </p>
      <div className="space-y-4 text-sm leading-relaxed text-muted">{children}</div>
    </main>
  );
}
