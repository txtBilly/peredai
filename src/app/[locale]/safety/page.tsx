import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import LegalPage from '@/components/LegalPage';

export default function SafetyPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  return (
    <LegalPage locale={params.locale as Locale} title="Safety">
      <p>
        Every member is verified: seekers pass a background and identity check before they can connect, and listers
        verify with a government ID before they can publish.
      </p>
      <p>
        Keep conversations on Ten2Ten. Never share sensitive financial details, wire money, or pay a deposit before
        you’ve seen the apartment and confirmed the arrangement in person. Meet in a safe, public way.
      </p>
      <p>
        If something feels wrong, report it from the chat or the listing. Reports are reviewed by our team; messages are
        never deleted, so we can see exactly what happened. Confirmed reports lead to strikes and removal.
      </p>
      <p className="text-muted/70">[Full safety guidelines pending legal review.]</p>
    </LegalPage>
  );
}
