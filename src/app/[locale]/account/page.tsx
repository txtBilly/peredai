import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import SiteHeader from '@/components/SiteHeader';

export default async function AccountPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const d = getDictionary(locale);
  const a = d.account;

  const user = await requireUser(locale);
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_first_name, full_name, email, verification_status, rating_avg, rating_count, created_at'
    )
    .eq('id', user.id)
    .single();

  const { data: ledger } = await supabase
    .from('credit_ledger')
    .select('amount')
    .eq('seeker_id', user.id);
  const creditBalance = (ledger ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const verificationStatus = profile?.verification_status ?? 'unverified';
  // Verification comes ONLY from the identity flow (Sber ID / T-ID). The legacy
  // background-check path is not part of the RU model and is never reached, so it
  // must never confer "Verified" — paying (or any other action) cannot shortcut
  // identity verification.
  const isVerified = verificationStatus === 'verified';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
        month: 'long', year: 'numeric',
      })
    : null;

  return (
    <>
      <SiteHeader locale={locale as Locale} />
      <main className="mx-auto max-w-lg px-5 py-16">
      <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>

      {/* Profile summary */}
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/[0.05] font-display text-xl text-ink">
          {profile?.display_first_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl text-ink">
              {profile?.display_first_name ?? user.email}
            </h1>
            {isVerified && <VerifiedBadge />}
          </div>
          {isVerified && profile?.full_name && (
            <p className="mt-0.5 text-sm text-ink">
              <span className="text-muted">{a.verifiedAs}</span> {profile.full_name}
            </p>
          )}
          <p className="text-sm text-muted">{profile?.email ?? user.email}</p>
          {memberSince && (
            <p className="mt-0.5 text-xs text-muted">{a.memberSince} {memberSince}</p>
          )}
        </div>
      </div>

      {/* Verification status card */}
      <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
        isVerified
          ? 'border-leaf/30 bg-leaf/10 text-leaf'
          : verificationStatus === 'pending'
          ? 'border-cobalt/30 bg-cobalt/10 text-cobalt'
          : verificationStatus === 'failed'
          ? 'border-red-300 bg-red-50 text-red-600'
          : 'border-black/10 bg-black/[0.03] text-muted'
      }`}>
        <div className="flex items-center justify-between">
          <span>
            {isVerified && (<><span aria-hidden="true">✓ </span>{a.verifiedBadge}</>)}
            {!isVerified && verificationStatus === 'pending' && (<><span aria-hidden="true">⏳ </span>{a.pending}</>)}
            {!isVerified && verificationStatus === 'failed' && (<><span aria-hidden="true">✗ </span>{a.failed}</>)}
            {!isVerified && verificationStatus === 'unverified' && (<><span aria-hidden="true">○ </span>{a.unverified}</>)}
          </span>
          {!isVerified && (
            <Link
              href={`/${locale}/verify`}
              className="ml-4 rounded-lg bg-gradient-cobalt px-3 py-1 text-xs font-medium text-white hover:brightness-110"
            >
              {a.verifyNow}
            </Link>
          )}
        </div>
      </div>

      {/* Contact credits */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3">
        <span className="text-sm text-muted">{a.creditsLabel}</span>
        <span className="font-display text-xl text-ink">{creditBalance}</span>
      </div>

      {/* Nav links */}
      <nav aria-label="Account navigation">
        <ul className="flex flex-col divide-y divide-black/[0.08] rounded-xl border border-black/10">
          {([
            { href: `/${locale}/saved`, label: a.savedPlaces, icon: '♡', danger: false },
            { href: `/${locale}/account/profile`, label: a.editProfile, icon: '✎', danger: false },
            { href: `/${locale}/account/notifications`, label: a.notifications, icon: '🔔', danger: false },
            { href: `/${locale}/support`, label: a.contactSupport, icon: '✉', danger: false },
            { href: `/${locale}/account/delete`, label: a.deleteAccount, icon: '⊗', danger: true },
          ] as const).map(({ href, label, icon, danger }) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center justify-between px-4 py-3.5 text-sm transition hover:bg-black/[0.03] ${
                  danger ? 'text-red-600' : 'text-ink'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-4 text-center text-muted" aria-hidden="true">{icon}</span>
                  {label}
                </span>
                <span className="text-muted" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sign out */}
      <form action="/api/auth/signout" method="POST" className="mt-6">
        <button
          type="submit"
          className="w-full rounded-lg border border-black/15 px-5 py-3 text-sm text-muted transition hover:border-black/30 hover:text-ink"
        >
          {a.signOut}
        </button>
      </form>
      </main>
    </>
  );
}
