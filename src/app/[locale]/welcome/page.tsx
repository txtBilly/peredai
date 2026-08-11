import Link from 'next/link';
import { getDictionary, isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import IntakeForm from '@/components/IntakeForm';

// Public marketing landing — the acquisition front door. Anonymous visitors land
// on Browse by default; this lives at /welcome and is linked from the nav and
// used for campaigns. Copy is the current dictionary copy pending the copy sweep.
export default function WelcomePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDictionary(locale);
  const otherLocale = locale === 'en' ? 'es' : 'en';

  const steps = [
    { n: '1', title: 'Find a place leaving soon', body: 'Browse verified apartments being passed on directly by the current renter.' },
    { n: '2', title: 'Pay $100 to connect', body: 'That’s 3 contact credits. Every seeker is background-checked before connecting.' },
    { n: '3', title: 'Meet & take it over', body: 'Chat, arrange a viewing, and take the lease. No broker, no broker fee.' },
  ];

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href={`/${locale}`} className="font-display text-xl text-paper">
          {dict.brand.name}
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
          <Link href={`/${locale}/browse`} className="hover:text-paper">{dict.nav.browse}</Link>
          <Link href={`/${locale}/list`} className="hover:text-paper">{dict.nav.list}</Link>
          <Link href={`/${locale}/signin`} className="hover:text-paper">{dict.nav.signIn}</Link>
          <Link
            href={`/${otherLocale}/welcome`}
            className="rounded-full border border-white/15 px-3 py-1 uppercase hover:border-white/40"
          >
            {otherLocale}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-10 sm:pt-16">
        <p className="mb-4 text-sm uppercase tracking-wide text-gold">{dict.home.heroEyebrow}</p>
        <h1 className="max-w-3xl font-display text-4xl leading-tight text-paper sm:text-6xl">{dict.home.heroTitle}</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">{dict.home.heroSubtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/browse`}
            className="rounded-lg bg-gold px-6 py-3 font-semibold text-ink transition hover:brightness-110"
          >
            Find a place
          </Link>
          <Link
            href={`/${locale}/list`}
            className="rounded-lg border border-white/20 px-6 py-3 font-medium text-paper transition hover:border-white/40"
          >
            List your apartment
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="mb-6 font-display text-2xl text-paper">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 font-display text-gold">
                {s.n}
              </div>
              <p className="mb-1 font-medium text-paper">{s.title}</p>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-wrap gap-6 text-sm text-paper/80">
          <span className="flex items-center gap-2"><span className="text-sage">✓</span> {dict.home.trustVerified}</span>
          <span className="flex items-center gap-2"><span className="text-sage">✓</span> {dict.home.trustNoFee}</span>
          <span className="flex items-center gap-2"><span className="text-sage">✓</span> {dict.home.trustGratitude}</span>
        </div>
      </section>

      {/* Intake — cold-start */}
      <section className="mx-auto max-w-2xl px-5 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="font-display text-2xl text-paper">{dict.intake.title}</h2>
          <p className="mb-6 mt-1 text-muted">{dict.intake.subtitle}</p>
          <IntakeForm dict={dict} locale={locale} />
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap gap-5 text-sm text-muted">
          <Link href={`/${locale}/terms`} className="hover:text-paper">{dict.footer.terms}</Link>
          <Link href={`/${locale}/privacy`} className="hover:text-paper">{dict.footer.privacy}</Link>
          <Link href={`/${locale}/safety`} className="hover:text-paper">{dict.footer.safety}</Link>
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted/70">{dict.footer.rights}</p>
      </footer>
    </main>
  );
}
