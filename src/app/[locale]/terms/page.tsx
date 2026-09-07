import type { Metadata } from 'next';
import Link from 'next/link';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import { CURRENT_CONSENT_VERSION } from '@/lib/consent';

export function generateMetadata(): Metadata {
  return {
    title: 'Пользовательское соглашение',
    description:
      'Пользовательское соглашение (публичная оферта) сервиса Ten2Ten — площадки передачи аренды напрямую между жильцами.',
  };
}

// Пользовательское соглашение / Публичная оферта Ten2Ten.
export default function TermsPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-2 mt-8 font-display text-xl font-semibold text-ink">{children}</h2>
  );
  const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3">{children}</p>;
  const UL = ({ children }: { children: React.ReactNode }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1.5">{children}</ul>
  );

  if (locale === 'en') {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-[15px] leading-relaxed text-ink/80">
        <Link href={`/${locale}/welcome`} className="text-sm text-muted hover:text-ink">
          ‹ Back
        </Link>

        <h1 className="mb-2 mt-4 font-display text-3xl font-bold text-ink">Terms of Use</h1>
        <p className="mb-8 text-sm text-muted">Public offer. Version {CURRENT_CONSENT_VERSION} (September 2026).</p>

        <H>1. General provisions</H>
        <P>
          These Terms of Use (hereinafter the “Agreement”) constitute a public offer of Ten2Ten LLC (ООО «Тен2Тен»)
          (“Ten2Ten”, hereinafter the “Operator”, INN 9715532264 · KPP 771501001 · OGRN 1267700290989) and set out the
          terms of use of the Ten2Ten service hosted on the website ten2ten.ru (hereinafter the “Service”, “Website”,
          “Platform”), and govern the relationship between the Operator and the person using the Ten2Ten.ru website
          (hereinafter the “User”).
        </P>
        <P>
          By using the Service (including by completing registration, verifying their identity, posting a listing or
          sending a request), the User confirms that they have read the terms of the Agreement, fully accept them
          (acceptance of the offer) and undertake to comply with them.
        </P>
        <P>
          The Operator reserves the unconditional right to refuse any user the use of the Service and the Platform, or
          any parts thereof, without stating reasons and/or for a breach of the terms of this Agreement, or for the
          commission or attempted commission by the User of unlawful, unfair or hostile actions against the Operator or
          other Users.
        </P>
        <P>
          The Operator is entitled to unilaterally amend the terms of the Agreement. A new version takes effect from the
          moment it is posted on the Website, unless the new version provides otherwise. The current version is available
          at{' '}
          <Link href={`/${locale}/terms`} className="text-cobalt hover:underline">
            ten2ten.ru/terms
          </Link>
          .
        </P>

        <H>2. Definitions</H>
        <UL>
          <li>
            <b>User</b> — an individual using the Service.
          </li>
          <li>
            <b>Lister</b> — a User who posts a rental listing.
          </li>
          <li>
            <b>Seeker</b> — a User who searches for housing and sends requests regarding listings of interest to them.
          </li>
          <li>
            <b>Tokens</b> — internal bonus units of the Service, provided by the Operator to Users (Seekers) for a fee or
            as a bonus, giving the ability to contact Listers. Tokens are not electronic money and are not subject to
            exchange for money; they cannot be transferred, gifted, sold or otherwise alienated in favour of third
            parties in any way. The Operator reserves the right to establish and change the terms and procedure for
            providing, using and the validity period of tokens at its own discretion.
          </li>
          <li>
            <b>Gratuity</b> — an amount determined by the Lister when creating a rental listing, which the participants
            of the chat (the Lister and the Seeker) may agree between themselves for the transfer of information about
            the rented premises; it is paid directly by the Seeker to the Lister outside the Service by mutual consent.
            The Operator does not regulate and bears no responsibility for the level of the Gratuity or the procedure for
            settlements, as these are carried out outside the Platform.
          </li>
          <li>
            <b>Listing</b> — a listing on the Ten2Ten Platform created and edited by the Lister. It contains photographs
            and a description of the material details of the premises offered for rent, as well as a button to contact
            the Lister. A Listing is not a public offer, but is regarded as an invitation to make offers (invitation to
            treat) in accordance with Art. 437 of the Civil Code of the Russian Federation.
          </li>
          <li>
            <b>Account</b> — a single personal part of the Ten2Ten Website providing the following functionality: (a)
            distinguishing the User among other Users; (b) the User's exercise of the rights to use the Operator's
            software programs and database; (c) the exchange of data, information and messages between the User and the
            Administration; (d) the exercise by the Operator's Administration of control over the User's exercise of the
            right to use the Operator's software programs and database. Access to the Account and its functionality is
            granted to the User after their registration on the Ten2Ten Website. The User has the right and the technical
            ability to independently delete their Account and personal data using the “Delete” button in the Profile
            section.
          </li>
          <li>
            <b>Sber ID and T-ID</b> — universal digital tools for fast and secure authorisation (log-in) on third-party
            websites, mobile applications and services without the need to create new passwords and logins. They are
            used by the Operator to identify Users on the Platform.
          </li>
        </UL>

        <H>3. Subject matter and nature of the Service</H>
        <P>
          The Platform is an information marketplace that provides Users with the technical ability to post rental
          listings for premises, find such listings and contact one another.
        </P>
        <P>
          3.1. The intermediary service (hereinafter the “Service”) of bringing together on the Platform Users seeking
          premises available for rent and persons willing to assist in finding such premises or who are rightholders or
          controllers of such premises (hereinafter “Listers”) is provided on a paid basis — for a fee paid by the Seeker
          and/or the Lister in favour of the Platform.
        </P>
        <P>
          3.2. The Operator is not a realtor, agent or broker, is not a party to a rental (tenancy) agreement or an
          intermediary in transactions between Users, and does not receive a commission on such transactions. The
          Operator does not act as an organiser of bidding, does not guarantee the conclusion of a rental agreement, the
          availability or quality of housing, and bears no responsibility for the actions of Users. All arrangements,
          including viewing, conclusion of the tenancy agreement and payment of the gratuity, are reached by the
          participants independently and at their own responsibility.
        </P>
        <P>
          3.3. The amount, procedure and method of paying the Fee are established by the Platform independently. The
          Service is deemed fully rendered at the moment contact (a chat) is established between the Seeker and the
          Lister on the Platform.
        </P>
        <P>
          3.4. The Operator has the right, but not the obligation, to moderate, monitor or be part of a chat. By default,
          the Operator does not moderate chats. Users have the right to contact the Operator with a complaint about the
          textual content of a chat for the purpose of compliance with this Agreement and the rules of use of the
          Service, as well as where signs of a violation of the legislation of the Russian Federation are detected.
        </P>
        <P>
          3.5. The Operator does not guarantee or ensure the payment of the Gratuity or any material reward to Users of
          the Service. The procedure and amount of settlements are determined by the Users independently. The Service
          does not provide technical means for tracking or paying the Gratuity.
        </P>
        <P>
          3.6. The Lister has the right to independently determine the level of the Gratuity and the procedure for
          settlements with the Seeker. However, the Lister is not entitled to demand payment of an advance, prepayment,
          deposit or any other sums before the physical viewing of the premises by the Seeker and the reaching of an
          agreement with the owner of the premises on renting the premises to the Seeker.
        </P>
        <P>
          3.7. In view of the above and within the framework of the applicable legislation of the Russian Federation, the
          Operator is not a tax agent, as it is not a source of payment of income to the taxpayer (clause 1, Art. 226 of
          the Tax Code of the Russian Federation). Users undertake to independently, and within the time limits set by
          the legislation of the Russian Federation, calculate and pay the tax payments established by law in connection
          with the Gratuity. The Service does not provide Users with advice on taxation matters. We recommend contacting
          professionals or asking a question to the staff of the Tax Inspectorate on the website{' '}
          <a href="https://www.nalog.gov.ru/" target="_blank" rel="noopener noreferrer" className="text-cobalt hover:underline">
            nalog.gov.ru
          </a>
          .
        </P>
        <P>
          3.8. The Operator reserves the right to moderate, change, delete or “shadow-ban” any Listings without stating
          reasons and/or for a breach of the rules of use of the Service, including where inaccurate information about
          the premises being rented out or its availability is provided.
        </P>

        <H>4. Registration and identity verification</H>
        <P>
          4.1. To use certain functions of the Service, the User completes registration and identity verification through
          external identification services — Sber ID and/or T-Bank (T-ID). By completing verification, the User agrees to
          the transfer to the Operator of information confirming their identity, to the extent set out in the{' '}
          <Link href={`/${locale}/privacy`} className="text-cobalt hover:underline">
            Privacy Policy
          </Link>
          .
        </P>
        <P>
          4.2. The User undertakes to provide accurate information, not to use another person's credentials, and not to
          transfer access to their account to third parties. The User is responsible for actions carried out under their
          account.
        </P>

        <H>5. Tokens and payment</H>
        <P>5.1. Tokens are purchased by the Seeker on the terms specified in the Service at the time of purchase.</P>
        <P>
          5.2. A Token is deemed used, and the Service rendered, at the moment contact is established (a chat is opened)
          between the Lister and the Seeker at the initiative of the Seeker.
        </P>
        <P>
          5.3. The procedure for refunding funds for unused Tokens is determined by consumer protection legislation and
          the rules of the Service; to obtain a refund, the User contacts support at the email address specified on the
          website.
        </P>
        <P>
          5.4. Settlements for the purchase of Tokens are processed by payment providers (Tochka Bank and others); the
          Operator does not store and has no access to card data.
        </P>

        <H>6. Terms for posting listings (for Listers)</H>
        <P>By posting a listing, the Lister confirms and undertakes that:</P>
        <P>
          6.1. The owner of the premises consents to the transfer of the premises under a rental agreement to a third
          party on the stated terms;
        </P>
        <P>
          6.2. The information about the property (district, metro, type, characteristics, price, photographs) is
          accurate and up to date;
        </P>
        <P>6.3. The Lister posts no more than 3 (three) listings during a calendar year;</P>
        <P>6.4. Posting the listing does not violate the rights of third parties or the terms of the Lister's tenancy agreement.</P>

        <H>7. Terms for Seekers</H>
        <P>7.1. The Seeker independently verifies the accuracy of the information about the property and the legal soundness of the transaction.</P>
        <P>
          7.2. The Seeker understands that access to a contact does not guarantee the conclusion of a tenancy agreement
          and that the decision on the transfer of the housing, the timing and the procedure for concluding the agreement
          is made by the Lister and the owner.
        </P>
        <P>
          7.3. All payments, other than the purchase of Tokens, are made by the Seeker directly and at their own
          responsibility, outside the Service.
        </P>

        <H>8. Prohibited actions</H>
        <P>The User is prohibited from:</P>
        <UL>
          <li>posting inaccurate, misleading or knowingly false information;</li>
          <li>violating the rights of third parties, including the rights of property owners and other tenants;</li>
          <li>posting offensive, unlawful content or content prohibited by law;</li>
          <li>using the Service for sending spam, automated data collection, circumventing restrictions or checks;</li>
          <li>impersonating another person or using another person's identification data;</li>
          <li>taking actions that impair the operability or security of the Service.</li>
        </UL>
        <P>
          In the event of a breach of this Agreement, the Operator is entitled to restrict or terminate the User's access
          to the Service, apply a system of warnings and blocks, and delete listings that violate the rules.
        </P>

        <H>9. Liability and disclaimer of warranties</H>
        <P>
          The Service is provided on an “as is” basis. The Operator does not guarantee the uninterrupted and error-free
          operation of the Service and bears no responsibility for the actions of Users, the content of listings, the
          reaching of arrangements between participants, or for any direct or indirect losses arising in connection with
          the use of or inability to use the Service, to the extent permitted by the legislation of the Russian
          Federation. In any event, the Operator's liability is limited to the amount paid by the User for Tokens over
          the last 12 months.
        </P>

        <H>10. Personal data</H>
        <P>
          The processing of Users' personal data is carried out in accordance with the{' '}
          <Link href={`/${locale}/privacy`} className="text-cobalt hover:underline">
            Privacy Policy
          </Link>{' '}
          and the{' '}
          <Link href={`/${locale}/personal-data-consent`} className="text-cobalt hover:underline">
            Consent to the distribution of personal data
          </Link>
          , which form an integral part of this Agreement.
        </P>

        <H>11. Intellectual property</H>
        <P>
          The rights to the Service, its software, design, trademarks and other elements belong to the Operator or are
          used by it on a lawful basis. By posting content (text, photographs), the User grants the Operator a
          non-exclusive, royalty-free licence to use it to the extent necessary for the operation of the Service, and
          confirms that they hold the rights to such content.
        </P>

        <H>12. Dispute resolution and applicable law</H>
        <P>
          The law of the Russian Federation applies to this Agreement. Disputes are resolved through negotiations and, if
          agreement is not reached, in court at the location of the Operator in accordance with the legislation of the
          Russian Federation, subject to the mandatory pre-trial claim procedure (the period for responding to a claim is
          30 working days).
        </P>

        <H>13. Operator's details</H>
        <UL>
          <li>Name: Ten2Ten LLC (ООО «Тен2Тен»)</li>
          <li>INN: 9715532264</li>
          <li>KPP: 771501001</li>
          <li>OGRN: 1267700290989</li>
          <li>Legal address: 127015, г. Москва, вн.тер.г. муниципальный округ Бутырский, ул. Новодмитровская, д. 2Б</li>
          <li>
            Email:{' '}
            <a href="mailto:support@ten2ten.ru" className="text-cobalt hover:underline">
              support@ten2ten.ru
            </a>
          </li>
        </UL>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 text-[15px] leading-relaxed text-ink/80">
      <Link href={`/${locale}/welcome`} className="text-sm text-muted hover:text-ink">
        ‹ Назад
      </Link>

      <h1 className="mb-2 mt-4 font-display text-3xl font-bold text-ink">Пользовательское соглашение</h1>
      <p className="mb-8 text-sm text-muted">Публичная оферта. Редакция {CURRENT_CONSENT_VERSION} (сентябрь 2026 г.)</p>

      <H>1. Общие положения</H>
      <P>
        Настоящее Пользовательское соглашение (далее — «Соглашение») является публичной офертой ООО «Тен2Тен»
        (“Ten2Ten”, “ТенТуТен”, далее — «Оператор», ИНН 9715532264 · КПП 771501001 · ОГРН 1267700290989) и определяет
        условия использования сервиса Ten2Ten, размещённого на сайте ten2ten.ru (далее — «Сервис», «Сайт»,
        “Платформа”) и регулирует отношения между Оператором и лицом, использующим сайт Ten2Ten.ru (далее —
        «Пользователь»).
      </P>
      <P>
        Используя Сервис (в том числе проходя регистрацию, подтверждение личности, размещая объявление или отправляя
        запрос), Пользователь подтверждает, что ознакомился с условиями Соглашения, и полностью их принимает (акцепт
        оферты) и обязуется их соблюдать.
      </P>
      <P>
        Оператор оставляет за собой безусловное право отказать любому пользователю в использовании Сервиса и Платформы,
        каких-либо их частей, без объяснения причин и/или за нарушение условий данного Соглашения, совершения или
        попыток совершения Пользователем противоправных, недобросовестных или враждебных действий в отношении Оператора
        или других Пользователей.
      </P>
      <P>
        Оператор вправе в одностороннем порядке изменять условия Соглашения. Новая редакция вступает в силу с момента её
        размещения на Сайте, если иное не предусмотрено новой редакцией. Действующая редакция доступна по адресу{' '}
        <Link href={`/${locale}/terms`} className="text-cobalt hover:underline">
          ten2ten.ru/terms
        </Link>
        .
      </P>

      <H>2. Термины</H>
      <UL>
        <li>
          <b>Пользователь</b> — физическое лицо, использующее Сервис.
        </li>
        <li>
          <b>Листер</b> (от англ. “Lister”) — пользователь, размещающий объявление об аренде.
        </li>
        <li>
          <b>Соискатель</b> — Пользователь, осуществляющий поиск жилья и направляющий запросы по заинтересовавшим его
          объявлениям.
        </li>
        <li>
          <b>Токены</b> — внутренние бонусные единицы Сервиса, предоставляемые Оператором Пользователям (Соискателям) за
          плату или в качестве бонуса для получения возможности связаться с Листерами. Токены не являются электронными
          денежными средствами и не подлежат обмену на деньги, не могут быть переданы, подарены, проданы или отчуждены в
          пользу третьих лиц каким-либо образом. Оператор оставляет за собой право устанавливать и изменять условия и
          порядок предоставления, использования и срок действия токенов по своему усмотрению.
        </li>
        <li>
          <b>Благодарность</b> — сумма, определяемая Листером при создании объявления об аренде, которую участники чата
          (Листер и Соискатель) могут согласовать между собой за передачу информации об арендуемом помещении;
          выплачивается напрямую Соискателем Листеру вне Сервиса по взаимному согласию. Оператор не регулирует и не несёт
          ответственности за уровень Благодарности и порядок расчётов, поскольку они осуществляются вне Платформы.
        </li>
        <li>
          <b>Объявление</b> — объявление на Платформе Ten2Ten, созданное и редактируемое Листером. Содержит фотографии и
          описание существенных деталей предлагаемого к аренде помещения, а также кнопку связи с Листером. Объявление не
          является публичной офертой, а рассматривается как приглашение делать оферты (вызов на оферту) в соответствии
          со ст. 437 ГК РФ.
        </li>
        <li>
          <b>Аккаунт</b> — единая персональная часть Сайта Ten2Ten, обеспечивающая функциональные возможности: (а)
          индивидуализации Пользователя среди других Пользователей; (б) реализации Пользователем прав использования
          Программ для ЭВМ и Базы данных Оператора; (в) обмена данными, информацией и сообщениями между Пользователем и
          Администрацией; (г) осуществления Администрацией Оператора контроля за ходом реализации Пользователем права
          использования Программ для ЭВМ и Базы данных Оператора. Доступ к Аккаунту и его функциональным возможностям
          предоставляется Пользователю после его регистрации на Сайте Ten2Ten. Пользователь имеет право и техническую
          возможность самостоятельно удалить свой Аккаунт и персональные данные, воспользовавшись кнопкой «Удалить» в
          разделе Профиль.
        </li>
        <li>
          <b>Sber ID и T-ID</b> — универсальные цифровые инструменты для быстрой и безопасной авторизации (входа) на
          сторонних сайтах, в мобильных приложениях и сервисах без необходимости заводить новые пароли и логины.
          Используются Оператором для идентификации Пользователей на Платформе.
        </li>
      </UL>

      <H>3. Предмет и характер Сервиса</H>
      <P>
        Платформа представляет собой информационную площадку, которая предоставляет Пользователям техническую
        возможность размещать объявления об аренде помещений, находить такие объявления и связываться друг с другом.
      </P>
      <P>
        3.1. Посредническая услуга (далее — «Услуга») по сведению на Платформе Пользователей, ищущих помещения,
        сдаваемые в аренду, и лиц, готовых оказать содействие в поиске таких помещений либо являющихся правообладателями,
        распорядителями таких помещений (далее — «Листеры»), предоставляется на возмездной основе — за вознаграждение,
        уплачиваемое Соискателем и/или Листером в пользу Платформы.
      </P>
      <P>
        3.2. Оператор не является риелтором, агентом, брокером, стороной договора аренды (найма) или посредником в
        сделках между Пользователями и не получает комиссию с таких сделок. Оператор не выступает организатором торгов,
        не гарантирует заключение договора аренды, доступность или качество жилья и не несёт ответственности за действия
        Пользователей. Все договорённости, включая осмотр, заключение договора найма и выплату благодарности, участники
        достигают самостоятельно и под свою ответственность.
      </P>
      <P>
        3.3. Размер, порядок и способ уплаты Вознаграждения устанавливается Платформой самостоятельно. Услуга считается
        полностью оказанной в момент установления контакта (чата) между Соискателем и Листером на Платформе.
      </P>
      <P>
        3.4. Оператор имеет право, но не обязанность, модерировать, мониторить чат или являться его частью. По умолчанию
        модерирование чата Оператором не осуществляется. Пользователи имеют право обратиться к Оператору с жалобой на
        текстовое содержание чата с целью соблюдения настоящего Соглашения и правил пользования Сервисом, а также в
        случае обнаружения признаков нарушения законодательства РФ.
      </P>
      <P>
        3.5. Оператор не гарантирует и не обеспечивает выплату Благодарности или какого-либо материального вознаграждения
        Пользователям Сервиса. Порядок и размер расчётов определяются самостоятельно Пользователями. Сервис не
        предоставляет технические возможности для отслеживания или выплаты Благодарности.
      </P>
      <P>
        3.6. Листер имеет право самостоятельно определять уровень Благодарности и порядок расчётов с Соискателем. Однако
        Листер не вправе требовать выплаты аванса, предоплаты, залога или иных сумм до физического просмотра помещения
        Соискателем и достижения соглашения с собственником помещения о сдаче помещения Соискателю.
      </P>
      <P>
        3.7. В силу указанного выше и в рамках действующего законодательства РФ Оператор не является налоговым агентом,
        поскольку не является источником выплаты доходов налогоплательщику (п. 1 ст. 226 НК РФ). Пользователи обязуются
        самостоятельно и в сроки, определённые законодательством РФ, осуществить расчёт и оплату установленных законом
        налоговых платежей, связанных с Благодарностью. Сервис не осуществляет консультации Пользователей по вопросам
        налогообложения. Рекомендуем обратиться к профессионалам или задать вопрос сотрудникам Налоговой инспекции на
        сайте{' '}
        <a href="https://www.nalog.gov.ru/" target="_blank" rel="noopener noreferrer" className="text-cobalt hover:underline">
          nalog.gov.ru
        </a>
        .
      </P>
      <P>
        3.8. Оператор оставляет за собой право модерировать, изменять, удалять или отправлять в «теневой бан» любые
        Объявления без объяснения причин и/или за нарушение правил пользования Сервисом, в том числе при указании
        недостоверных сведений о сдаваемом помещении или его доступности.
      </P>

      <H>4. Регистрация и подтверждение личности</H>
      <P>
        4.1. Для использования отдельных функций Сервиса Пользователь проходит регистрацию и подтверждение личности
        через внешние сервисы идентификации — Сбер ID и/или Т-Банк (T-ID). Проходя подтверждение, Пользователь
        соглашается с передачей Оператору сведений, подтверждающих его личность, в объёме, указанном в{' '}
        <Link href={`/${locale}/privacy`} className="text-cobalt hover:underline">
          Политике конфиденциальности
        </Link>
        .
      </P>
      <P>
        4.2. Пользователь обязуется предоставлять достоверные сведения, не использовать чужие учётные данные и не
        передавать доступ к своей учётной записи третьим лицам. Пользователь несёт ответственность за действия,
        совершённые под его учётной записью.
      </P>

      <H>5. Токены и оплата</H>
      <P>5.1. Токены приобретаются Соискателем на условиях, указанных в Сервисе на момент покупки.</P>
      <P>
        5.2. Токен считается использованным, а Услуга оказанной, в момент установления контакта (открытия чата) между
        Листером и Соискателем по инициативе Соискателя.
      </P>
      <P>
        5.3. Порядок возврата средств за неиспользованные Токены определяется законодательством о защите прав
        потребителей и правилами Сервиса; для возврата Пользователь обращается в поддержку по адресу электронной почты,
        указанному на сайте.
      </P>
      <P>
        5.4. Расчёты за приобретение Токенов обрабатываются платёжными провайдерами (Точка Банк и другими); Оператор не
        хранит и не имеет доступа к данным карт.
      </P>

      <H>6. Условия размещения объявлений (для Листеров)</H>
      <P>Размещая объявление, Листер подтверждает и обязуется, что:</P>
      <P>
        6.1. Собственник помещения согласен на передачу помещения по договору аренды третьему лицу на заявленных
        условиях;
      </P>
      <P>6.2. Сведения об объекте (район, метро, тип, характеристики, стоимость, фотографии) достоверны и актуальны;</P>
      <P>6.3. Листер размещает не более 3 (трёх) объявлений в течение календарного года;</P>
      <P>6.4. Размещение объявления не нарушает прав третьих лиц и условий договора найма Листера.</P>

      <H>7. Условия для Соискателей</H>
      <P>7.1. Соискатель самостоятельно проверяет достоверность сведений об объекте и правовую чистоту сделки.</P>
      <P>
        7.2. Соискатель осознаёт, что доступ к контакту не гарантирует заключение договора найма и что решение о передаче
        жилья, сроках и порядке заключения договора принимают Листер и собственник.
      </P>
      <P>
        7.3. Все платежи, кроме приобретения Токенов, Соискатель совершает напрямую и под свою ответственность, вне
        Сервиса.
      </P>

      <H>8. Запрещённые действия</H>
      <P>Пользователю запрещается:</P>
      <UL>
        <li>размещать недостоверную, вводящую в заблуждение или заведомо ложную информацию;</li>
        <li>нарушать права третьих лиц, в том числе права собственников жилья и иных арендаторов;</li>
        <li>размещать оскорбительный, противоправный или запрещённый законодательством контент;</li>
        <li>использовать Сервис для рассылки спама, автоматического сбора данных, обхода ограничений или проверок;</li>
        <li>выдавать себя за другое лицо, использовать чужие данные идентификации;</li>
        <li>совершать действия, нарушающие работоспособность или безопасность Сервиса.</li>
      </UL>
      <P>
        При нарушении настоящего Соглашения Оператор вправе ограничить или прекратить доступ Пользователя к Сервису,
        применить систему предупреждений и блокировок, а также удалить объявления, нарушающие правила.
      </P>

      <H>9. Ответственность и отказ от гарантий</H>
      <P>
        Сервис предоставляется на условиях «как есть» (as is). Оператор не гарантирует бесперебойную и безошибочную
        работу Сервиса и не несёт ответственности за действия Пользователей, содержание объявлений, достижение
        договорённостей между участниками, а также за прямые или косвенные убытки, возникшие в связи с использованием
        или невозможностью использования Сервиса, в пределах, допускаемых законодательством Российской Федерации.
        Ответственность Оператора в любом случае ограничена суммой, уплаченной Пользователем за Токены за последние 12
        месяцев.
      </P>

      <H>10. Персональные данные</H>
      <P>
        Обработка персональных данных Пользователей осуществляется в соответствии с{' '}
        <Link href={`/${locale}/privacy`} className="text-cobalt hover:underline">
          Политикой конфиденциальности
        </Link>{' '}
        и{' '}
        <Link href={`/${locale}/personal-data-consent`} className="text-cobalt hover:underline">
          Согласием на распространение персональных данных
        </Link>
        , являющимися неотъемлемой частью настоящего Соглашения.
      </P>

      <H>11. Интеллектуальная собственность</H>
      <P>
        Права на Сервис, его программное обеспечение, дизайн, товарные знаки и иные элементы принадлежат Оператору или
        используются им на законном основании. Размещая контент (текст, фотографии), Пользователь предоставляет Оператору
        неисключительную безвозмездную лицензию на его использование в объёме, необходимом для работы Сервиса, и
        подтверждает наличие у него прав на такой контент.
      </P>

      <H>12. Разрешение споров и применимое право</H>
      <P>
        К настоящему Соглашению применяется право Российской Федерации. Споры разрешаются путём переговоров, а при
        недостижении согласия — в суде по месту нахождения Оператора в соответствии с законодательством Российской
        Федерации, с соблюдением обязательного претензионного порядка (срок ответа на претензию — 30 рабочих дней).
      </P>

      <H>13. Реквизиты Оператора</H>
      <UL>
        <li>Наименование: ООО «Тен2Тен»</li>
        <li>ИНН: 9715532264</li>
        <li>КПП: 771501001</li>
        <li>ОГРН: 1267700290989</li>
        <li>Юридический адрес: 127015, г. Москва, вн.тер.г. муниципальный округ Бутырский, ул. Новодмитровская, д. 2Б</li>
        <li>
          Электронная почта:{' '}
          <a href="mailto:support@ten2ten.ru" className="text-cobalt hover:underline">
            support@ten2ten.ru
          </a>
        </li>
      </UL>
    </main>
  );
}
