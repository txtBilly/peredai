import Link from 'next/link';
import type { Locale } from '@/i18n/config';

// Shell for the legal/info pages (safety, consents, …).
export default function LegalPage({
  locale,
  title,
  children,
}: {
  locale: Locale;
  title: string;
  children: React.ReactNode;
}) {
  const back = locale === 'en' ? '‹ Back' : '‹ Назад';
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <Link href={`/${locale}/welcome`} className="text-sm text-muted hover:text-ink">
        {back}
      </Link>
      <h1 className="mb-6 mt-4 font-display text-3xl text-ink">{title}</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted">{children}</div>
    </main>
  );
}
