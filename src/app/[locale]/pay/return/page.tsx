import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import AcquiringReturnPoller from './AcquiringReturnPoller';

export const dynamic = 'force-dynamic';

type IntentRow = { seeker_id: string; status: string };

// Where Tochka's hosted payment page sends the buyer back after paying. We poll
// the acquiring operation status and grant the tokens once it's APPROVED, then
// forward to the success page. Tochka has already emailed the fiscal receipt.
export default async function PayReturnPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { ref?: string; next?: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const ref = typeof searchParams.ref === 'string' ? searchParams.ref : '';
  if (!ref) redirect(`/${locale}/pay`);

  const rawNext = typeof searchParams.next === 'string' ? searchParams.next : '';
  const next = rawNext.startsWith(`/${locale}/`) ? rawNext : `/${locale}/account?purchase=success`;

  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) redirect(`/${locale}/signin`);

  const admin = createAdminClient();
  const { data } = await admin
    .from('sbp_intents')
    .select('seeker_id, status')
    .eq('qrc_id', ref)
    .maybeSingle();
  const intent = data as IntentRow | null;
  if (!intent || intent.seeker_id !== user.id) redirect(`/${locale}/pay`);
  if (intent.status === 'granted') redirect(next);

  const en = locale === 'en';
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 py-12 text-center">
      <h1 className="font-display text-2xl text-ink">
        {en ? 'Confirming your payment…' : 'Подтверждаем оплату…'}
      </h1>
      <p className="mt-2 max-w-xs text-sm text-ink/60">
        {en
          ? 'This takes a few seconds. Your tokens will appear and the receipt is on its way by email.'
          : 'Это займётся несколько секунд. Токены появятся, а чек придёт на почту.'}
      </p>

      <AcquiringReturnPoller refId={ref} next={next} locale={locale} />

      <Link href={`/${locale}/account`} className="mt-8 text-xs text-ink/50 underline">
        {en ? 'Go to my account' : 'Перейти в аккаунт'}
      </Link>
    </main>
  );
}
