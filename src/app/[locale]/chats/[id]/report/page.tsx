import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import { createClient } from '@/lib/supabase/server';
import ReportView from './ReportView';

export default async function ReportPage({ params }: { params: { locale: string; id: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  // Determine whether the reporter is the lister or the seeker of this chat, so
  // the report form can show role-appropriate reasons.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: 'lister' | 'seeker' = 'seeker';
  if (user) {
    const { data: chat } = await supabase
      .from('chats')
      .select('lister_id')
      .eq('id', params.id)
      .maybeSingle();
    if (chat?.lister_id === user.id) role = 'lister';
  }

  return (
    <>
      <SiteHeader locale={locale} />
      <ReportView locale={locale} chatId={params.id} role={role} />
    </>
  );
}
