import type { Metadata } from 'next';
import Link from 'next/link';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import { CURRENT_CONSENT_VERSION } from '@/lib/consent';

export function generateMetadata(): Metadata {
  return {
    title: 'Согласие на подтверждение личности',
    description:
      'Согласие на подтверждение личности через Сбер ID / Т-Банк ID для размещения объявлений на Ten2Ten.',
  };
}

// Standalone consent for identity verification via Sber ID (and, where offered,
// T-Bank ID). Layout/title styling matches the privacy page. Linked from the
// signup/reconsent consent checkboxes and the footer.
export default function IdentityConsentPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-2 mt-8 font-display text-xl font-semibold text-ink">{children}</h2>
  );
  const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3">{children}</p>;

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 text-[15px] leading-relaxed text-ink/80">
      <Link href={`/${locale}/welcome`} className="text-sm text-muted hover:text-ink">
        ‹ Назад
      </Link>

      <h1 className="mb-2 mt-4 font-display text-3xl font-bold text-ink">Согласие на подтверждение личности</h1>
      <p className="mb-8 text-sm text-muted">Редакция {CURRENT_CONSENT_VERSION} (сентябрь 2026 г.)</p>

      <P>
        Настоящим я даю согласие оператору — ООО «Тен2Тен» (ИНН 9715532264, КПП 771501001; далее — «Оператор») — на
        подтверждение моей личности с использованием сервиса банковской идентификации Сбер ID (а также иных аналогичных
        сервисов, например Т-Банк ID), а также на получение и обработку связанных с этим данных.
      </P>

      <H>Как это работает</H>
      <P>
        При подтверждении личности вы авторизуетесь через выбранный банковский сервис. Банк по вашему согласию передаёт
        Оператору сведения, необходимые для подтверждения личности: фамилию и имя, а также факт успешной идентификации.
        Оператор не получает и не хранит ваши банковские реквизиты, пароли и коды из СМС.
      </P>

      <H>Цели</H>
      <P>
        Подтверждение личности арендодателя перед размещением объявления; повышение доверия и безопасности сообщества;
        отображение статуса «Проверен» и подтверждённого имени другим участникам в рамках общения на платформе.
      </P>

      <H>Хранение и защита</H>
      <P>
        Полученные данные обрабатываются в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных
        данных» и хранятся в базах данных, расположенных на территории Российской Федерации. Подробнее — в{' '}
        <Link href={`/${locale}/privacy`} className="text-cobalt hover:underline">
          Политике конфиденциальности
        </Link>
        .
      </P>

      <H>Срок действия и отзыв</H>
      <P>
        Согласие действует до достижения целей обработки либо до его отзыва. Отозвать согласие можно в любой момент,
        обратившись к Оператору; при этом может быть ограничена возможность размещать объявления, требующие
        подтверждённой личности.
      </P>
    </main>
  );
}
