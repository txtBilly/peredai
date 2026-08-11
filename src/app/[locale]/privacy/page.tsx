import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import LegalPage from '@/components/LegalPage';

export default function PrivacyPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  return (
    <LegalPage locale={params.locale as Locale} title="Privacy Policy">
      <p>
        We collect what we need to run the marketplace: account details, listing information, verification results, and
        messages between members (which are immutable and retained for trust-and-safety review).
      </p>
      <p>
        Your Social Security number and full credit report are passed to our verification vendor and are never stored
        by Ten2Ten. Only your verified name, a derived credit band, and background-check status are retained; on
        Connect, your name and credit band (never your SSN or full report) are disclosed to the lister.
      </p>
      <p>
        Government-ID photos submitted for lister verification are stored privately and are not shown to other members.
      </p>
      <p className="text-muted/70">[Full privacy policy pending legal review.]</p>
    </LegalPage>
  );
}
