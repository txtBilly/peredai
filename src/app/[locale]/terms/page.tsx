import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import LegalPage from '@/components/LegalPage';

export default function TermsPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  return (
    <LegalPage locale={params.locale as Locale} title="Terms of Service">
      <p>
        Peredai is a peer-to-peer platform where verified members pass New York City apartments directly to one
        another. We are not a broker and charge no broker fee; the $100 contact bundle purchases the ability to
        connect, not a rental.
      </p>
      <p>
        Listers are responsible for their listings and for the accuracy of the information they provide. Seekers are
        responsible for their own due diligence before entering any lease or making any off-platform payment. Gratitude
        amounts are arranged directly between members off-platform; Peredai does not facilitate or verify them.
      </p>
      <p>
        Members agree to a background/identity verification appropriate to their role, to the automatic disclosure of
        their verified name and credit band to a lister on Connect, and to the community rules including the reporting
        and strike system.
      </p>
      <p className="text-muted/70">[Full terms pending legal review.]</p>
    </LegalPage>
  );
}
