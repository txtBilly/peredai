import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary, isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const ru = params.locale !== 'en';
  return {
    title: ru ? 'Как это работает' : 'How it works',
    description: ru
      ? 'Как устроен Ten2Ten: жильцы передают аренду напрямую, без риелторов и комиссии. Проверка личности, безопасные чаты, благодарность за передачу.'
      : 'How Ten2Ten works: tenants hand rentals over directly, with no realtors or commission. Verified identities, safe chats, a thank-you for passing it on.',
  };
}

// Value-prop icons for the hero (for the one looking).
function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="M20 8h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1Z" />
      <path d="M16.5 10h.01" />
    </svg>
  );
}

// Public marketing landing — the acquisition front door. Anonymous visitors land
// on Browse by default; this lives at /welcome and is linked from the nav and
// used for campaigns. Copy is the current dictionary copy pending the copy sweep.
export default function WelcomePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDictionary(locale);

  const w = dict.welcome;
  const steps = w.steps.map((s, i) => ({ n: String(i + 1), title: s.title, body: s.body }));
  const reviews = w.reviews;

  return (
    <main className="min-h-screen">
      <SiteHeader locale={locale} />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-10 sm:pt-16">
        <p className="mb-4 text-sm uppercase tracking-wide text-cobalt">{dict.home.heroEyebrow}</p>
        <h1 className="font-display text-[27px] font-bold leading-tight text-ink sm:text-[45px]">
          {(() => {
            // Break after the opening question ("Moving soon?" / "¿Te mudas pronto?")
            // so the second clause drops to its own line.
            const idx = dict.home.heroTitle.indexOf('? ');
            if (idx === -1) return dict.home.heroTitle;
            return (
              <>
                {dict.home.heroTitle.slice(0, idx + 1)}
                <br />
                {/* Second line a step smaller. */}
                <span className="text-[22px] sm:text-[36px]">{dict.home.heroTitle.slice(idx + 2)}</span>
              </>
            );
          })()}
        </h1>

        {/* Value props for the one looking (the handover message is now the subtitle). */}
        <div className="mt-6 max-w-3xl">
          <p className="mb-2.5 text-sm font-semibold text-cobalt">{w.value.seekTitle}</p>
          <ul className="flex flex-col gap-3 text-lg text-ink/90">
            {w.value.seekItems.map((t, i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cobalt/12 text-cobalt">
                  {i === 0 ? <IconSearch /> : <IconWallet />}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${locale}/browse`}
            className="w-full whitespace-nowrap rounded-lg bg-gradient-cobalt px-4 py-3 text-center font-semibold text-white transition hover:brightness-110 sm:w-auto sm:px-6"
          >
            {w.findCta}
          </Link>
          <Link
            href={`/${locale}/list`}
            className="w-full whitespace-nowrap rounded-lg bg-ink px-4 py-3 text-center font-semibold text-white transition hover:brightness-110 sm:w-auto sm:px-6"
          >
            {w.listCta}
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="mb-6 font-display text-3xl font-bold text-ink">{w.howTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-black/10 bg-black/[0.02] p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-cobalt/15 font-display text-lg font-bold text-cobalt">
                {s.n}
              </div>
              <p className="mb-1.5 text-[14.4px] font-semibold text-ink">{s.title}</p>
              <p className="text-base leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-col gap-3 font-display text-lg font-semibold text-ink sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-10 sm:gap-y-2 sm:text-xl">
          <span className="flex items-start gap-2.5"><span className="text-2xl leading-none text-leaf">✓</span> {dict.home.trustVerified}</span>
          <span className="flex items-start gap-2.5"><span className="text-2xl leading-none text-leaf">✓</span> {dict.home.trustGratitude}</span>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="mb-6 font-display text-2xl font-bold text-ink">{w.reviewsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {reviews.map((r, i) => {
            const hues = [
              { edge: 'rgba(27,77,228,0.55)', glow: 'rgba(27,77,228,0.14)' },   // cobalt
              { edge: 'rgba(236,72,153,0.50)', glow: 'rgba(236,72,153,0.13)' }, // pink
              { edge: 'rgba(16,185,129,0.50)', glow: 'rgba(16,185,129,0.13)' }, // emerald
              { edge: 'rgba(245,158,11,0.55)', glow: 'rgba(245,158,11,0.14)' }, // amber
              { edge: 'rgba(124,58,237,0.55)', glow: 'rgba(124,58,237,0.14)' }, // violet
              { edge: 'rgba(6,182,212,0.50)', glow: 'rgba(6,182,212,0.13)' },   // cyan
            ];
            const h = hues[i % hues.length];
            return (
              <div
                key={r.name}
                className="h-full rounded-2xl p-[1px] shadow-sm"
                // Gradient border anchored at the top-left corner (matches the glow),
                // so the top AND left edges stay colored and fade to a neutral hairline.
                style={{ background: `radial-gradient(140% 140% at 0% 0%, ${h.edge}, rgba(0,0,0,0.10) 55%)` }}
              >
                <figure
                  className="flex h-full flex-col rounded-[15px] p-5"
                  // Soft colored glow radiating from the top-left corner into white.
                  style={{ background: `radial-gradient(125% 95% at 0% 0%, ${h.glow}, transparent 55%), #ffffff` }}
                >
                  <div className="mb-3 flex gap-0.5 text-amber-400" aria-label="5 out of 5 stars">
                    {'★★★★★'.split('').map((s, k) => (
                      <span key={k} aria-hidden="true">{s}</span>
                    ))}
                  </div>
                  <blockquote className="mb-4 text-sm leading-relaxed text-ink/80">“{r.quote}”</blockquote>
                  <figcaption className="mt-auto">
                    <span className="text-sm font-medium text-ink">{r.name}</span>
                    <span className="text-xs text-muted"> · {r.detail}</span>
                  </figcaption>
                </figure>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap gap-5 text-sm text-muted">
          <Link href={`/${locale}/terms`} className="hover:text-ink">{dict.footer.terms}</Link>
          <Link href={`/${locale}/privacy`} className="hover:text-ink">{dict.footer.privacy}</Link>
          <Link href={`/${locale}/safety`} className="hover:text-ink">{dict.footer.safety}</Link>
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted/70">{dict.footer.rights}</p>
      </footer>
    </main>
  );
}
