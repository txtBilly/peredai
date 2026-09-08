import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getQr } from '@/lib/tochka';
import SbpQrPoller from './SbpQrPoller';

export const dynamic = 'force-dynamic';

type IntentRow = {
  seeker_id: string;
  credits: number;
  price_rub: number;
  status: string;
};

// On-site SBP QR checkout. The confirm route registers a dynamic QR with Tochka,
// stores the intent, and sends the seeker here. We render the QR (scan on
// desktop, or tap the payload link on mobile to open a bank app) and poll for
// payment; tokens are granted server-side the moment Tochka reports "Accepted".
export default async function PayQrPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { qrc?: string; next?: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const qrc = typeof searchParams.qrc === 'string' ? searchParams.qrc : '';
  if (!qrc) redirect(`/${locale}/pay`);

  // Only allow a same-locale relative return path (no open redirect).
  const rawNext = typeof searchParams.next === 'string' ? searchParams.next : '';
  const next =
    rawNext.startsWith(`/${locale}/`) ? rawNext : `/${locale}/account?purchase=success`;

  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) redirect(`/${locale}/signin`);

  const admin = createAdminClient();
  const { data } = await admin
    .from('sbp_intents')
    .select('seeker_id, credits, price_rub, status')
    .eq('qrc_id', qrc)
    .maybeSingle();
  const intent = data as IntentRow | null;
  if (!intent || intent.seeker_id !== user.id) redirect(`/${locale}/pay`);
  if (intent.status === 'granted') redirect(next);

  const en = locale === 'en';
  const qr = await getQr(qrc);
  const priceLabel = `${intent.price_rub.toLocaleString('ru-RU')} ₽`;
  const tokenLabel = en
    ? `${intent.credits} ${intent.credits === 1 ? 'token' : 'tokens'}`
    : `${intent.credits} ${intent.credits === 1 ? 'токен' : 'токенов'}`;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center px-5 py-12 text-center">
      <h1 className="font-display text-2xl text-ink">
        {en ? 'Scan to pay via SBP' : 'Отсканируйте для оплаты через СБП'}
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        {en
          ? `${tokenLabel} · ${priceLabel} — open your bank app and scan the QR.`
          : `${tokenLabel} · ${priceLabel} — откройте приложение банка и отсканируйте QR.`}
      </p>

      {qr.ok ? (
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          {qr.qr.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr.qr.imageDataUrl}
              alt={en ? 'SBP payment QR code' : 'QR-код для оплаты по СБП'}
              width={280}
              height={280}
              className="h-[280px] w-[280px]"
            />
          ) : (
            <a href={qr.qr.payload} className="break-all text-sm text-cobalt underline">
              {qr.qr.payload}
            </a>
          )}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {en
            ? 'Could not load the QR code. Please go back and try again.'
            : 'Не удалось загрузить QR-код. Вернитесь и попробуйте снова.'}
        </div>
      )}

      {qr.ok && qr.qr.imageDataUrl && (
        <a
          href={qr.qr.payload}
          className="mt-4 text-sm text-cobalt underline sm:hidden"
        >
          {en ? 'Or tap to open your bank app' : 'Или нажмите, чтобы открыть приложение банка'}
        </a>
      )}

      <SbpQrPoller qrc={qrc} next={next} locale={locale} />

      <Link href={`/${locale}/pay`} className="mt-8 text-xs text-ink/50 underline">
        {en ? 'Cancel' : 'Отменить'}
      </Link>

      <p className="mt-6 max-w-xs text-[11px] leading-relaxed text-ink/40">
        {en
          ? 'The QR is valid for 60 minutes. Tokens are added automatically once the payment clears.'
          : 'QR-код действует 60 минут. Токены начислятся автоматически после оплаты.'}
      </p>
    </main>
  );
}
