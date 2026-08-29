import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SiteHeader from '@/components/SiteHeader';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const ru = params.locale !== 'en';
  return {
    title: ru ? 'Разместить объявление' : 'Post a listing',
    description: ru
      ? 'Разместите объявление и передайте свою квартиру следующему жильцу напрямую — без риелторов и комиссии.'
      : 'Post a listing and hand your apartment to the next tenant directly — no realtors, no commission.',
  };
}

// The listing form is entirely client-driven (Supabase reads, nothing
// server-fetchable) and was hitting hydration mismatches on its loading text,
// so it's loaded with `ssr: false` — the server never renders it, so there's
// nothing for the client to reconcile against. See ListForm.tsx for the form
// logic itself.
const ListForm = dynamic(() => import('./ListForm'), {
  ssr: false,
  loading: () => (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 text-center">
      <p className="mb-2 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
      <p className="text-sm text-muted">Loading…</p>
    </main>
  ),
});

export default async function ListPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  // Server-side identity gate: only verified members reach the listing form.
  // Unverified users are sent straight to the verification flow and return to
  // /list afterwards. Doing this on the server (cookie auth) is reliable and
  // instant — the client ListForm's getUser() can race on the ssr:false first
  // paint and misroute (e.g. bounce to /signin), which is why "Разместить
  // квартиру" appeared to do nothing for unverified users. ListForm keeps its
  // own client-side check as defense in depth.
  const user = await requireUser(locale);
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.verification_status !== 'verified') {
    redirect(`/${locale}/verify?next=list`);
  }

  return (
    <>
      <SiteHeader locale={locale} />
      <ListForm locale={locale} />
    </>
  );
}
