import type { Metadata } from 'next';
import Link from 'next/link';
import { isLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { notFound } from 'next/navigation';
import { CURRENT_CONSENT_VERSION } from '@/lib/consent';

export function generateMetadata(): Metadata {
  return {
    title: 'Политика конфиденциальности',
    description:
      'Политика в отношении обработки персональных данных пользователей Ten2Ten в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».',
  };
}

export default function PrivacyPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-2 mt-8 font-display text-xl font-semibold text-ink">{children}</h2>
  );
  const Section = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-3 mt-12 border-t border-black/10 pt-8 font-display text-2xl font-bold text-ink">{children}</h2>
  );
  const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3">{children}</p>;
  const UL = ({ children }: { children: React.ReactNode }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1.5">{children}</ul>
  );
  const termsLink = (
    <Link href={`/${locale}/terms`} className="text-cobalt hover:underline">
      Пользовательского соглашения
    </Link>
  );
  const mail = (
    <a href="mailto:support@ten2ten.ru" className="text-cobalt hover:underline">
      support@ten2ten.ru
    </a>
  );
  // Repeated processing/retention boilerplate that follows most purposes below.
  const AUTO = (
    <P>
      Персональные данные обрабатываются с использованием средств автоматизации. Обработка персональных данных
      осуществляется в течение сроков действия Лицензионного соглашения и/или Правил пользования сайтом Ten2Ten и до
      истечения сроков хранения соответствующих данных, определяемых в соответствии с действующим законодательством
      Российской Федерации. Персональные данные уничтожаются при достижении целей их обработки или при наступлении иных
      законных оснований путём удаления информации.
    </P>
  );
  // English counterpart of the repeated processing/retention boilerplate.
  const AUTO_EN = (
    <P>
      Personal data is processed using automation tools. Personal data is processed for the term of the License
      Agreement and/or the Ten2Ten site usage rules and until the expiry of the applicable retention periods
      determined in accordance with the current legislation of the Russian Federation. Personal data is destroyed
      upon achievement of the purposes of its processing or upon other lawful grounds by deleting the information.
    </P>
  );

  if (locale === 'en') {
    const termsLinkEn = (
      <Link href={`/${locale}/terms`} className="text-cobalt hover:underline">
        Terms of Use
      </Link>
    );
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-[15px] leading-relaxed text-ink/80">
        <Link href={`/${locale}/welcome`} className="text-sm text-muted hover:text-ink">
          ‹ Back
        </Link>

        <h1 className="mb-2 mt-4 font-display text-3xl font-bold text-ink">
          Personal Data Processing Policy
        </h1>
        <p className="mb-8 text-sm text-muted">Version {CURRENT_CONSENT_VERSION} (September 2026).</p>

        <H>1. General provisions</H>
        <P>
          This Policy on the processing of personal data (hereinafter, the “Policy”) is an integral part of the Terms
          of Use and defines the procedure for processing and protecting the personal data of users of the Ten2Ten
          (ТенТуТен) service, available on the ten2ten.ru website and in mobile applications (hereinafter collectively,
          the “Service”).
        </P>
        <P>
          The Policy has been developed in accordance with the Constitution of the Russian Federation, Federal Law
          No. 152-FZ of 27 July 2006 “On Personal Data” (hereinafter, “Law No. 152-FZ”), Federal Law No. 149-FZ of
          27 July 2006 “On Information, Information Technologies and Information Protection”, and other regulatory legal
          acts of the Russian Federation.
        </P>
        <P>For specific services, Ten2Ten may publish additional terms that supplement this Policy.</P>
        <P>The personal data operator is Ten2Ten LLC (ООО «Тен2Тен») (hereinafter, the “Operator”):</P>
        <UL>
          <li>INN: 9715532264</li>
          <li>KPP: 771501001</li>
          <li>OGRN: 1267700290989</li>
          <li>Address: 127015, г. Москва, вн.тер.г. муниципальный округ Бутырский, ул. Новодмитровская, д. 2Б</li>
          <li>Email: {mail}</li>
          <li>Website: ten2ten.ru</li>
        </UL>
        <P>
          By using the Service, the User confirms their agreement with this Policy. If the User does not agree, the
          User must refrain from using the Service.
        </P>

        <Section>Privacy Policy</Section>
        <P>
          The Ten2Ten Privacy Policy (hereinafter, the “Policy”) contains information about how Ten2Ten processes and
          protects personal data.
        </P>

        <H>1. General provisions of the policy</H>
        <P>
          1.1. This Policy is an integral part of the {termsLinkEn} and the License Agreement, as well as of other
          agreements concluded with the User in the course of using the Ten2Ten Group Sites, where their terms
          expressly provide for this.
        </P>
        <P>
          1.2. This Policy applies to all personal data that Ten2Ten may receive from the User during the use of the
          Ten2Ten Sites and mobile applications.
        </P>
        <P>
          1.3. Ten2Ten does not control and is not responsible for third-party websites to which the User may navigate
          via links available on the Ten2Ten sites. Third-party sites may have their own privacy policy, and other
          personal data may be collected from or requested of the User there.
        </P>
        <P>For specific services, Ten2Ten may publish additional terms that supplement this Policy.</P>

        <H>2. Categories and purposes of personal data processing</H>
        <P>
          2.1. The primary purpose of personal data processing is to perform the obligations to the User provided for
          by the Ten2Ten License Agreement and other agreements on the use of the services of the Ten2Ten Sites and
          mobile applications. More detailed information about the purposes of personal data processing and the
          categories of processed data is set out in the Ten2Ten License Agreement and the relevant agreements with the
          User.
        </P>
        <P>
          2.2. By using the Site, mobile applications, and individual Ten2Ten Services (hereinafter collectively, the
          Services), the personal data subject (an individual or a representative of a legal entity) thereby freely, by
          their own will and in their own interest, provides their personal data to Ten2Ten for processing.
        </P>
        <P>
          2.3. Personal data processing means the actions or set of actions provided for by Federal Law No. 152-FZ of
          27 July 2006 “On Personal Data” performed with or without the use of automation tools with personal data,
          including collection, recording, systematization, accumulation, storage, updating (renewal, alteration),
          extraction, use, transfer (distribution, provision, access), removal, and destruction of personal data.
        </P>
        <P>
          2.4. Processing of the personal data of a User who is an individual may be carried out for purposes
          including:
        </P>
        <P>
          2.4.1. Registration and subsequent authorization of the User (including through additional authorization
          functions via external services or data exchange with them, for example, Sber ID, T ID, VK ID, mobile
          operator services), provision of services to the User, and enabling the User to make contact regarding the
          listings submitted. To achieve this purpose, the following are processed: full name, User identifier, email
          address, phone number, place of residence address, registration address, date of birth, place of birth,
          identity document details (passport data), User’s photograph, sex, INN, and information about a concluded
          contract for mobile radiotelephone communication services.
        </P>
        {AUTO_EN}
        <P>
          2.4.1.1. Registration and subsequent authorization of the User (including through additional authorization
          functions via external services or data exchange with them, for example, Sber ID, T ID, VK ID, mobile
          operator services), provision of services to the User, and enabling the User to make contact and exchange
          numbers for the purposes of analyzing and selecting real estate properties solely for personal and family
          needs unrelated to carrying out commercial activity to promote information, consulting, or other services or
          to distribute any advertising information. To achieve this purpose, the following are processed: full name,
          User identifier, email address, phone number, place of residence address, registration address, date of
          birth, place of birth, identity document details (passport data), User’s photograph, user id (Telegram), sex,
          INN, and information about a concluded contract for mobile radiotelephone communication services.
        </P>
        {AUTO_EN}
        <P>
          2.4.2. Provision of customer support. To achieve this purpose, the following are processed: full name, email
          address, mobile phone number, audio recordings of telephone conversations concerning the listings submitted,
          User identifier, and purchases.
        </P>
        {AUTO_EN}
        <P>
          2.4.3. Quality control of the listings presented on the ten2ten.ru website. To achieve this purpose, the
          following are processed: full name, phone number, audio recordings of telephone conversations concerning the
          listings submitted, passport data, date and place of birth, registration address, information about family
          composition, INN, photograph, cadastral number of the real estate property, and the surname, first name, and
          patronymic of the property owner.
        </P>
        {AUTO_EN}
        <P>
          2.4.4. Processing of requests received from government authorities. To achieve this purpose, the following are
          processed: full name, phone number, email address, and IP.
        </P>
        {AUTO_EN}
        <P>
          2.4.5. Organization of targeted advertising and mailings, as well as other means of promoting the goods,
          works, and services of Ten2Ten and/or Ten2Ten’s partners, including by making direct contact through means of
          communication. To achieve this purpose, the following are processed: full name, email address, phone number,
          and User identifier.
        </P>
        {AUTO_EN}
        <P>
          2.4.6. Providing access to the Site’s Services, use of their functional capabilities, and maintaining their
          security. Depending on the Service used, the following are processed: full name (including former names, if
          previously changed), email address, phone number, User identifier, phone book contact details (when contact
          details are created in the Site’s personal account), citizenship, sex, identity document details, date of
          birth, place of birth, registration/residence address (including city), marital status, employment
          information (including type of employment, position, length of service), taxpayer identification number,
          number of the mandatory pension insurance certificate, information about the property status and real estate
          properties belonging to the User (including from documents provided by the User confirming ownership or the
          grounds for acquiring the real estate), information about financial status, income, and credit burden, payment
          data, information about the location of the user’s device, photo, audio recording of a telephone call, video
          image (except for biometric personal data), information about actions on the Site (including attendance (time
          of day, day of the week, month, time at which actions were performed), views, number and frequency of visits,
          time spent on the site), as well as the ID/type of the operating system of the device used by the User and IP
          address, including through the use of metric software.
        </P>
        {AUTO_EN}
        <P>
          2.4.7. Identifying reviews of the services rendered and assessing the work of employees in order to obtain
          information about the performance of the contract concluded with the User for the use of the Site’s Services.
          To achieve this purpose, the following are processed: User identifier, email address, mobile phone number, and
          the User’s surname and first name.
        </P>
        {AUTO_EN}
        <P>
          2.4.8. Conducting research into the needs, motivation, and preferences of Users, their actions, and their use
          of the functions of the Site’s Services in order to improve the quality and functionality of the Site’s
          Services and to prevent fraudulent actions. To achieve this purpose, the following are processed: User
          identifier, phone number, email address, surname, first name, patronymic, sex, age, region, city of
          residence, occupation, information about the listings presented on the Site, segment (user category), and
          information about actions on the Company’s website/mobile application (about the User’s views, including taking
          into account their preferences in searching for real estate, for example, the city/region of the search, term,
          method of financing the purchase, category and class of real estate, promotional offers, price range, and
          other search filters).
        </P>
        {AUTO_EN}
        <P>
          2.4.9. Organizing communication between the User and Ten2Ten’s partners (developers, real estate agencies,
          etc.). To achieve this purpose, the following are processed: surname, first name, patronymic, User identifier,
          email address, and mobile phone number.
        </P>
        {AUTO_EN}
        <P>
          2.4.10. Conducting analytics of the use of the Site’s Services, including analysis of Users’ actions on the
          Site, in order to adapt the Services to the needs of Users. To achieve this purpose, the following are
          processed: User identifier, phone number, and information about the User’s actions on the Site.
        </P>
        <P>
          2.4.11. Enabling participation in consultations, webinars, broadcasts, and other similar events held by real
          estate professionals on matters of searching for and selecting real estate, and collecting feedback following
          such events. To achieve this purpose, the following are processed: full name, User identifier, email address,
          phone number, information about participation in events (including topic, date, time of the event), and a
          photo and/or video image not used for identification purposes.
        </P>
        <P>
          2.4.12. Ensuring Users’ compliance with the Terms of Use and achieving Ten2Ten’s other legitimate interests
          in connection with the use of the Site’s Services (storing information about Users during the limitation
          periods, information about facts of violation of the Terms of Use, etc.). To achieve this purpose, the
          following are processed: full name, User identifier, email address, and mobile phone number.
        </P>
        {AUTO_EN}
        <P>
          2.5. Processing of the personal data of the representatives of a User that is a legal entity may be carried
          out for purposes including:
        </P>
        <P>
          2.5.1. Recording partner representatives for subsequent communication and conducting sales department
          analytics. To achieve this purpose, the following are processed: full name, User identifier, email address,
          phone number, purchases, and other metrics.
        </P>
        {AUTO_EN}
        <P>
          2.5.2. Provision of customer support. To achieve this purpose, the following are processed: full name, User
          identifier, audio recordings of telephone conversations concerning the listings submitted, place of work,
          email address, and phone number.
        </P>
        {AUTO_EN}
        <P>
          2.5.3. Quality control of the listings presented on the ten2ten.ru Site. To achieve this purpose, the
          following are processed: full name, place of work and office address, email address, phone number, audio
          recordings of telephone conversations concerning the listings submitted, and photograph.
        </P>
        {AUTO_EN}
        <P>
          2.5.4. Providing access to the Site’s Services, use of their functional capabilities, and maintaining their
          security. Depending on the Service used, the following are processed: full name, email address, phone number,
          User identifier, phone book contact details (when contact details are created in the Site’s personal account),
          information about the location of the user’s device, photo, audio recording of a telephone call, video image
          (except for biometric personal data), information about actions on the Site (including attendance (time of
          day, day of the week, month, time at which actions were performed), views, number and frequency of visits,
          time spent on the site), as well as the ID/type of the operating system of the device used by the User and IP
          address.
        </P>
        {AUTO_EN}
        <P>
          2.5.5. Conducting research to understand the needs, motivation, and preferences of Users, their actions, and
          their use of the functions of the Site’s Services in order to improve the quality and functionality of the
          Site’s Services. To achieve this purpose, the following are processed: User identifier, phone number, email
          address, surname, first name, patronymic, sex, age, region, city of residence, occupation, information about
          the listings presented on the Site, and the name of the legal entity (agency, realtor, realtor’s partner).
        </P>
        {AUTO_EN}
        <P>
          2.5.6. Identifying reviews of the services rendered and assessing the work of employees in order to obtain
          information about the performance of the contract concluded with the User for the use of the Site’s Services.
          To achieve this purpose, the following are processed: User identifier, email address, mobile phone number, and
          the User’s surname and first name.
        </P>
        {AUTO_EN}
        <P>
          2.5.7. Organizing communication between the User and Ten2Ten’s partners (developers, real estate agencies,
          etc.). To achieve this purpose, the following are processed: full name, User identifier, email address, mobile
          phone number, place of work, and position.
        </P>
        {AUTO_EN}
        <P>
          2.5.8. Enabling the holding of consultations, webinars, broadcasts, and other similar events by real estate
          professionals on matters of searching for and selecting real estate, and collecting feedback following such
          events. To achieve this purpose, the following are processed: full name, User identifier, email address, phone
          number, place of work, position, profession, information about participation in events (including topic, date,
          time of the event), and a photo and/or video image not used for identification purposes.
        </P>
        {AUTO_EN}
        <P>
          2.5.9. Organizing client events and meetings. To achieve this purpose, the following are processed: full name,
          User identifier, email address, mobile phone number, place of work, position, and a photo/video image not used
          for identification purposes (as part of recording online meetings).
        </P>
        {AUTO_EN}
        <P>
          2.5.10. Ensuring Users’ compliance with the Terms of Use and achieving Ten2Ten’s other legitimate interests in
          connection with the use of the Site’s Services (storing information about Users during the limitation periods,
          information about facts of violation of the Terms of Use, etc.). To achieve this purpose, the following are
          processed: full name, User identifier, email address, and mobile phone number.
        </P>
        {AUTO_EN}
        <P>
          2.6. To achieve the purposes defined in this Policy, Ten2Ten may transfer the User’s personal data to third
          parties. The transfer of personal data to third parties is carried out to the extent necessary for the
          purposes of its processing. The third parties to whom Ten2Ten may transfer the User’s personal data include:
          real estate agencies (when using the realtor search service), communication service providers, providers of
          services for mailing informational and advertising materials (if the User subscribes to such mailings),
          partners providing Ten2Ten with services for the use of information and intermediary services (including when
          transferring applications to credit institutions at the User’s initiative), as well as services for verifying
          the reliability of a transaction carried out by the User, Ten2Ten’s affiliated persons, persons acting on
          Ten2Ten’s behalf, and other third parties to whom the transfer of data is necessary to perform Ten2Ten’s
          obligations to the User in accordance with this Policy. The transfer of personal data to third parties is
          carried out under contracts concluded with third parties that include obligations to maintain the
          confidentiality of the data received. The transfer of personal data may also be carried out in the territory
          of foreign states.
        </P>
        <P>
          2.7. When publishing listings, reviews, comments, or questions on the Site, as well as when posting other
          information in their profile, the personal data contained in such information becomes available to an
          indefinite range of persons. The User is notified that they disclose such data independently without providing
          Ten2Ten, as the personal data operator, with separate consent. Ten2Ten processes such personal data for the
          purpose of performing the contract (for the use of the Site’s functional capabilities) with the User,
          concluded at the User’s initiative.
        </P>
        <P>
          2.8. Processing of the User’s personal data is carried out during the terms provided for in the {termsLinkEn}
          {' '}and the License Agreement, as well as in other agreements concluded with the User in the course of using
          the Ten2Ten Sites and/or mobile application. To terminate the processing of personal data by Ten2Ten, the User
          must perform the actions provided for by the documents referred to above; at the same time, the User’s
          personal data may continue to be processed thereafter for the period necessary to perform the obligations
          imposed on Ten2Ten in accordance with the legislation of the Russian Federation. In such a case, personal data
          processing will be carried out to the extent necessary to comply with the said obligations.
        </P>

        <H>3. Principles and methods of personal data processing</H>
        <P>3.1. When processing personal data, Ten2Ten is guided by the following principles:</P>
        <UL>
          <li>ensuring the lawfulness of the purposes and methods of personal data processing;</li>
          <li>
            conformity of the purposes of personal data processing with the purposes determined and stated in advance
            at the time of collecting personal data;
          </li>
          <li>
            conformity of the volume and nature of the processed personal data, as well as the methods of personal data
            processing, with the purposes of personal data processing;
          </li>
          <li>the absence of personal data excessive in relation to the purposes stated at the time of collection;</li>
          <li>ensuring the accuracy of the processed personal data;</li>
          <li>the use of separate databases for incompatible purposes of personal data processing.</li>
        </UL>
        <P>
          3.2. Ten2Ten processes personal data both with and without the use of automation tools.
        </P>

        <H>4. Rules of personal data processing</H>
        <P>
          4.1. Personal data is obtained directly from Users in the course of using the Ten2Ten Sites and mobile
          applications, except in the cases provided for by the Policy, as well as in other agreements concluded with
          the User in the course of using the Ten2Ten Group Sites, where their terms expressly provide for this.
        </P>
        <P>
          4.2. The collection of personal data is carried out using the Ten2Ten Group Sites located in the territory of
          the Russian Federation.
        </P>
        <P>
          4.3. In the cases provided for by Ten2Ten’s personal data processing procedures, personal data may be
          transferred to third parties. The transfer of personal data to third parties may be carried out with the
          User’s consent, as well as in the cases provided for by the legislation of the Russian Federation and on the
          basis of the requirements of federal laws. More detailed information about the third parties to whom personal
          data may be transferred, as well as about the conditions under which personal data is transferred to third
          parties, is set out in the License Agreement, offer agreements, and other agreements that the User accepts when
          applying for services on the Ten2Ten Group Sites.
        </P>
        <P>
          4.4. Personal data processing is carried out during the term of the License Agreement, another agreement, or
          agreement on the use of the services of the Ten2Ten Sites and mobile applications, and for the periods
          established by the legislation of the Russian Federation.
        </P>

        <H>5. Ensuring the security of personal data</H>
        <P>
          5.1. Ten2Ten takes all necessary protective measures, including those provided for by the legislation of the
          Russian Federation, aimed at ensuring the confidentiality and security of personal data. The personal data
          protection measures applied by Ten2Ten include, among others:
        </P>
        <UL>
          <li>a person responsible for ensuring the security of personal data at Ten2Ten has been appointed;</li>
          <li>current threats to the security of personal data have been identified;</li>
          <li>
            a set of protective measures has been developed and implemented to neutralize current security threats;
          </li>
          <li>rules for ensuring the security of personal data during its processing have been defined;</li>
          <li>
            periodic monitoring and assessment of the effectiveness of the personal data protection measures taken is
            carried out.
          </li>
        </UL>

        <H>6. Users’ rights in respect of their personal data</H>
        <P>
          6.1. In accordance with Federal Law No. 152-FZ of 27 July 2006 “On Personal Data”, Users have the right to:
        </P>
        <P>6.1.1. request information about their personal data processed by Ten2Ten, including:</P>
        <UL>
          <li>confirmation of the fact of personal data processing;</li>
          <li>the legal grounds and purposes of personal data processing;</li>
          <li>the methods of personal data processing applied;</li>
          <li>
            the full name and location of Ten2Ten, information about third parties who have access to personal data or
            to whom personal data may be disclosed on the basis of a contract with Ten2Ten or on the basis of federal
            law;
          </li>
          <li>the categories of processed personal data and the source from which they were obtained;</li>
          <li>the periods of personal data processing, including the periods of their storage;</li>
          <li>
            the procedure for exercising the rights of the personal data subject provided for by law;
          </li>
          <li>information about any cross-border transfer of data carried out or intended;</li>
          <li>
            the name and address of the person processing personal data on Ten2Ten’s behalf, if the processing is or
            will be entrusted to such a person;
          </li>
          <li>other information provided for by law;</li>
        </UL>
        <P>6.1.2. demand to be acquainted with the processed personal data;</P>
        <P>
          6.1.3. demand the clarification of personal data if it is incomplete, outdated, or inaccurate;
        </P>
        <P>
          6.1.4. demand the blocking of personal data if it is incomplete, outdated, or inaccurate, or if its
          processing by Ten2Ten is unlawful;
        </P>
        <P>
          6.1.5. demand the destruction of personal data if it was obtained unlawfully or is not necessary for the
          stated purpose of processing, or in the event of withdrawal of consent to the processing of personal data;
        </P>
        <P>
          6.1.6. demand that Ten2Ten notify all persons to whom incorrect or incomplete personal data was previously
          communicated of all exclusions, corrections, or additions made to it;
        </P>
        <P>
          6.1.7. appeal, to the authorized body for the protection of the rights of personal data subjects or in court,
          against unlawful actions or inaction of Ten2Ten in the processing and protection of their personal data.
        </P>

        <H>7. Clarification and destruction of personal data</H>
        <P>
          7.1. Clarification of personal data is carried out by the User independently using the functions of the Sites
          and mobile applications.
        </P>
        <P>7.2. Personal data processed by Ten2Ten is subject to destruction in the following cases:</P>
        <UL>
          <li>
            upon achievement of the purposes of its processing or in the event that the need to achieve them is lost,
            within a period not exceeding thirty days from the moment the purpose of personal data processing is
            achieved, unless otherwise provided by a contract to which the personal data subject is a party,
            beneficiary, or guarantor, or by another agreement between Ten2Ten and the personal data subject;
          </li>
          <li>
            in the event that unlawful processing of personal data by Ten2Ten is identified, within a period not
            exceeding ten business days from the moment the unlawful processing of personal data is identified;
          </li>
          <li>
            in the event that the personal data subject withdraws consent to the processing of their personal data, if
            the retention of the personal data is no longer required for the purposes of personal data processing,
            within a period not exceeding thirty days from the date of receipt of the said withdrawal, unless otherwise
            provided by a contract to which the personal data subject is a party, beneficiary, or guarantor, or by
            another agreement between Ten2Ten and the personal data subject;
          </li>
          <li>
            in the event of the expiry of the personal data retention period, determined in accordance with the
            legislation of the Russian Federation and Ten2Ten’s organizational and administrative documents;
          </li>
          <li>
            in the event of an order from the authorized body for the protection of the rights of personal data
            subjects, the Prosecutor’s Office of Russia, or a court decision.
          </li>
        </UL>
        <P>
          7.3. Consent to the processing of personal data may be withdrawn by the User at any time. To exercise the
          right of withdrawal, the User must send the corresponding request to {mail}.
        </P>
        <P>
          7.4. The withdrawal of the User’s consent to the processing of personal data cannot serve as grounds for the
          termination of processing where Ten2Ten has the grounds provided for by clauses 2, 7, and 10 of part 1 of
          article 6 of Federal Law No. 152-FZ of 27 July 2006 “On Personal Data”.
        </P>

        <H>8. Contact information</H>
        <P>
          For matters concerning the processing of personal data: Ten2Ten LLC (ООО «Тен2Тен»), INN 9715532264, OGRN
          1267700290989, 127015, г. Москва, вн.тер.г. муниципальный округ Бутырский, ул. Новодмитровская, д. 2Б, email
          {' '}{mail}.
        </P>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 text-[15px] leading-relaxed text-ink/80">
      <Link href={`/${locale}/welcome`} className="text-sm text-muted hover:text-ink">
        ‹ Назад
      </Link>

      <h1 className="mb-2 mt-4 font-display text-3xl font-bold text-ink">
        Политика в отношении обработки персональных данных
      </h1>
      <p className="mb-8 text-sm text-muted">Редакция {CURRENT_CONSENT_VERSION} (сентябрь 2026 г.)</p>

      <H>1. Общие положения</H>
      <P>
        Настоящая Политика в отношении обработки персональных данных (далее — «Политика») является неотъемлемой частью
        Пользовательского соглашения и определяет порядок обработки и защиты персональных данных пользователей сервиса
        Ten2Ten (ТенТуТен), доступного на сайте ten2ten.ru и в мобильных приложениях (далее совместно — «Сервис»).
      </P>
      <P>
        Политика разработана в соответствии с Конституцией Российской Федерации, Федеральным законом от 27.07.2006
        № 152-ФЗ «О персональных данных» (далее — «Закон № 152-ФЗ»), Федеральным законом от 27.07.2006 № 149-ФЗ «Об
        информации, информационных технологиях и о защите информации» и иными нормативными правовыми актами Российской
        Федерации.
      </P>
      <P>Для конкретных услуг Ten2Ten может публиковать дополнительные условия, дополняющие настоящую политику.</P>
      <P>Оператором персональных данных является ООО «Тен2Тен» (далее — «Оператор»):</P>
      <UL>
        <li>ИНН: 9715532264</li>
        <li>КПП: 771501001</li>
        <li>ОГРН: 1267700290989</li>
        <li>Адрес: 127015, г. Москва, вн.тер.г. муниципальный округ Бутырский, ул. Новодмитровская, д. 2Б</li>
        <li>Электронная почта: {mail}</li>
        <li>Вебсайт: ten2ten.ru</li>
      </UL>
      <P>
        Используя Сервис, Пользователь подтверждает согласие с настоящей Политикой. В случае несогласия Пользователь
        обязан воздержаться от использования Сервиса.
      </P>

      <Section>Политика конфиденциальности</Section>
      <P>
        Политика конфиденциальности Ten2Ten (далее по тексту — «Политика») содержит информацию о том, как Ten2Ten
        осуществляет обработку и защищает персональные данные.
      </P>

      <H>1. Общие положения политики</H>
      <P>
        1.1. Настоящая Политика является неотъемлемой частью {termsLink} и Лицензионного договора, а также иных
        заключаемых с Пользователем договоров в процессе пользования Сайтами Группы Ten2Ten, когда это прямо
        предусмотрено их условиями.
      </P>
      <P>
        1.2. Настоящая Политика действует в отношении всех персональных данных, которые Ten2Ten может получить от
        Пользователя во время использования Сайтов и мобильных приложений Ten2Ten.
      </P>
      <P>
        1.3. Ten2Ten не контролирует и не несёт ответственность за сайты третьих лиц, на которые Пользователь может
        перейти по ссылкам, доступным на сайтах Ten2Ten. На сайтах третьих лиц может быть собственная политика
        конфиденциальности, и у Пользователя могут собираться или запрашиваться иные персональные данные.
      </P>
      <P>1.4. Для конкретных услуг Ten2Ten может публиковать дополнительные условия, дополняющие настоящую политику.</P>

      <H>2. Состав и цели обработки персональных данных</H>
      <P>
        2.1. Основной целью обработки персональных данных является выполнение обязательств перед Пользователем,
        предусмотренных Лицензионным соглашением Ten2Ten и иными соглашениями по использованию сервисов Сайтов и
        мобильных приложений Ten2Ten. Более подробная информация о целях обработки персональных данных и составе
        обрабатываемых данных приведена в Лицензионном соглашении Ten2Ten и соответствующих соглашениях с Пользователем.
      </P>
      <P>
        2.2. Используя Сайт, мобильные приложения, отдельные Сервисы Ten2Ten (далее вместе именуемые Сервисы), субъект
        персональных данных (физическое лицо или представитель юридического лица) тем самым свободно, своей волей и в
        своём интересе предоставляет свои персональные данные Ten2Ten для их обработки.
      </P>
      <P>
        2.3. Под обработкой персональных данных понимаются предусмотренные Федеральным законом от 27.07.2006 № 152-ФЗ
        «О персональных данных» действия или совокупность действий, совершаемых с использованием средств автоматизации
        или без использования таких средств с персональными данными, включая сбор, запись, систематизацию, накопление,
        хранение, уточнение (обновление, изменение), извлечение, использование, передачу (распространение,
        предоставление, доступ), удаление, уничтожение персональных данных.
      </P>
      <P>
        2.4. Обработка персональных данных Пользователя, являющегося физическим лицом, может осуществляться в целях,
        включая:
      </P>
      <P>
        2.4.1. Регистрация и последующая авторизация Пользователя (в том числе с использованием дополнительных функций
        авторизации через внешние сервисы или обмен данными с ними, например, Sber ID, T ID, VK ID, сервисы операторов
        сотовой связи), оказание услуг Пользователю и предоставление Пользователю возможности осуществления контактов по
        теме поданных объявлений. Для достижения данной цели обработке подлежат: ФИО, идентификатор Пользователя, адрес
        электронной почты, номер телефона, адрес проживания, адрес регистрации, дата рождения, место рождения, реквизиты
        документа, удостоверяющего личность (паспортные данные), фотография Пользователя, пол, ИНН, сведения о
        заключённом договоре на услуги подвижной радиотелефонной связи.
      </P>
      {AUTO}
      <P>
        2.4.1.1. Регистрация и последующая авторизация Пользователя (в том числе с использованием дополнительных функций
        авторизации через внешние сервисы или обмен данными с ними, например, Sber ID, T ID, VK ID, сервисы операторов
        сотовой связи), оказание услуг Пользователю и предоставление Пользователю возможности осуществления контактов и
        обмена номерами для целей анализа и отбора объектов недвижимости исключительно для личных и семейных нужд, не
        связанных с осуществлением коммерческой деятельности по продвижению информационно-консультационных и иных услуг,
        распространения любой рекламной информации. Для достижения данной цели обработке подлежат: ФИО, идентификатор
        Пользователя, адрес электронной почты, номер телефона, адрес проживания, адрес регистрации, дата рождения, место
        рождения, реквизиты документа, удостоверяющего личность (паспортные данные), фотография Пользователя, user id
        (Telegram), пол, ИНН, сведения о заключённом договоре на услуги подвижной радиотелефонной связи.
      </P>
      {AUTO}
      <P>
        2.4.2. Осуществление клиентской поддержки. Для достижения данной цели обработке подлежат: ФИО, адрес электронной
        почты, номер мобильного телефона, аудиозаписи телефонных разговоров по тематике поданных объявлений,
        идентификатор Пользователя, покупки.
      </P>
      {AUTO}
      <P>
        2.4.3. Контроль качества представленных на сайте ten2ten.ru объявлений. Для достижения данной цели обработке
        подлежат: ФИО, номер телефона, аудиозаписи телефонных разговоров по тематике поданных объявлений, паспортные
        данные, дата и место рождения, адрес регистрации, сведения о составе семьи, ИНН, фотография, кадастровый номер
        объекта недвижимости, фамилия, имя и отчество владельца недвижимости.
      </P>
      {AUTO}
      <P>
        2.4.4. Обработка запросов, поступающих от государственных органов. Для достижения данной цели обработке подлежат:
        ФИО, номер телефона, адрес электронной почты, IP.
      </P>
      {AUTO}
      <P>
        2.4.5. Организация таргетированной рекламы и рассылок, а также иных способов продвижения товаров, работ, услуг
        Ten2Ten и/или партнёров Ten2Ten, в том числе путём осуществления прямых контактов с помощью средств связи. Для
        достижения данной цели обработке подлежат: ФИО, адрес электронной почты, номер телефона, идентификатор
        Пользователя.
      </P>
      {AUTO}
      <P>
        2.4.6. Обеспечение доступа к Сервисам Сайта, использования их функциональных возможностей и поддержание их
        безопасности. В зависимости от используемого Сервиса обработке подлежат: ФИО (в том числе прежние, если ранее
        изменялись), адрес электронной почты, номер телефона, идентификатор Пользователя, контактные данные телефонной
        книги (при формировании контактных данных в личном кабинете Сайта), гражданство, пол, реквизиты документа,
        удостоверяющего личность, дата рождения, место рождения, адрес регистрации/проживания (в том числе город),
        семейное положение, сведения о работе (в том числе о типе занятости, должности, стаже), идентификационный номер
        налогоплательщика, номер страхового свидетельства обязательного пенсионного страхования, сведения об
        имущественном положении и принадлежащих Пользователю объектах недвижимости (в том числе из предоставленных
        Пользователем документов, подтверждающих право собственности или основание приобретения недвижимости), сведения
        о финансовом положении, доходах, кредитной нагрузке, платёжные данные, сведения о месте нахождения
        пользовательского устройства, фото, аудиозапись телефонного звонка, видеоизображение (за исключением
        биометрических персональных данных), сведения о действиях на Сайте (в том числе о посещаемости (времени суток,
        дне недели, месяце, времени, когда совершались действия), просмотрах, количестве и периодичности визитов,
        времени, проведённом на сайте), а также об ID/типе операционной системы используемого Пользователем устройства,
        IP-адресе), в том числе с использованием метрических программ.
      </P>
      {AUTO}
      <P>
        2.4.7. Выявление отзывов об оказанных услугах, оценка работы сотрудников для получения информации об исполнении
        заключённого с Пользователем договора по использованию Сервисов Сайта. Для достижения данной цели обработке
        подлежат: идентификатор Пользователя, адрес электронной почты, номер мобильного телефона, фамилия, имя
        Пользователя.
      </P>
      {AUTO}
      <P>
        2.4.8. Проведение исследований потребностей, мотивации и предпочтений Пользователей, их действий и использования
        функций Сервисов Сайта с целью улучшения качества и функциональности Сервисов Сайта, предотвращения совершения
        мошеннических действий. Для достижения данной цели обработке подлежат: идентификатор Пользователя, номер
        телефона, адрес электронной почты, фамилия, имя, отчество, пол, возраст, регион, город проживания, род
        занятости, информация об объявлениях, представленных на Сайте, сегмент (категория пользователя), сведения о
        действиях на сайте/в мобильном приложении Компании (о просмотрах Пользователя, в том числе с учётом его
        предпочтений в поиске недвижимости, например, город/область поиска, срок, способ финансирования покупки,
        категория и класс недвижимости, акционные предложения, ценовой диапазон и иные фильтры поиска).
      </P>
      {AUTO}
      <P>
        2.4.9. Организация коммуникации между Пользователем и партнёрами Ten2Ten (застройщики, агентства недвижимости и
        др.). Для достижения данной цели обработке подлежат: фамилия, имя, отчество, идентификатор Пользователя, адрес
        электронной почты, номер мобильного телефона.
      </P>
      {AUTO}
      <P>
        2.4.10. Проведение аналитики использования Сервисов Сайта, включая анализ действий Пользователей на Сайте, в
        целях адаптации Сервисов под потребности Пользователей. Для достижения данной цели обработке подлежат:
        идентификатор Пользователя, номер телефона, сведения о действиях Пользователя на Сайте.
      </P>
      <P>
        2.4.11. Обеспечение возможности участия в проводимых консультациях, вебинарах, трансляциях и иных аналогичных
        мероприятиях от профессионалов в области недвижимости по вопросам поиска и подбора недвижимости, сбор обратной
        связи по итогам проведения таких мероприятий. Для достижения данной цели обработке подлежат: ФИО, идентификатор
        Пользователя, адрес электронной почты, номер телефона, сведения об участии в мероприятиях (в том числе тема,
        дата, время проведения), фото- и/или видеоизображение, не используемое в целях идентификации.
      </P>
      <P>
        2.4.12. Обеспечение соблюдения Пользователями Пользовательского соглашения и достижение иных законных интересов
        Ten2Ten в рамках использования Сервисов Сайта (хранение сведений о Пользователях в течение сроков исковой
        давности, сведений о фактах нарушения Пользовательского соглашения и др.). Для достижения данной цели обработке
        подлежат: ФИО, идентификатор Пользователя, адрес электронной почты, номер мобильного телефона.
      </P>
      {AUTO}
      <P>
        2.5. Обработка персональных данных представителей Пользователя, являющегося юридическим лицом, может
        осуществляться в целях, включая:
      </P>
      <P>
        2.5.1. Учёт представителей партнёров для последующей коммуникации и проведения аналитики отдела продаж. Для
        достижения данной цели обработке подлежат: ФИО, идентификатор Пользователя, адрес электронной почты, номер
        телефона, покупки, иные метрики.
      </P>
      {AUTO}
      <P>
        2.5.2. Осуществление клиентской поддержки. Для достижения данной цели обработке подлежат: ФИО, идентификатор
        Пользователя, аудиозаписи телефонных разговоров по тематике поданных объявлений, место работы, адрес электронной
        почты, номер телефона.
      </P>
      {AUTO}
      <P>
        2.5.3. Контроль качества представленных на Сайте ten2ten.ru объявлений. Для достижения данной цели обработке
        подлежат: ФИО, место работы и адрес офиса, адрес электронной почты, номер телефона, аудиозаписи телефонных
        разговоров по тематике поданных объявлений, фотография.
      </P>
      {AUTO}
      <P>
        2.5.4. Обеспечение доступа к Сервисам Сайта, использования их функциональных возможностей и поддержание их
        безопасности. В зависимости от используемого Сервиса обработке подлежат: ФИО, адрес электронной почты, номер
        телефона, идентификатор Пользователя, контактные данные телефонной книги (при формировании контактных данных в
        личном кабинете Сайта), сведения о месте нахождения пользовательского устройства, фото, аудиозапись телефонного
        звонка, видеоизображение (за исключением биометрических персональных данных), сведения о действиях на Сайте (в
        том числе о посещаемости (времени суток, дне недели, месяце, времени, когда совершались действия), просмотрах,
        количестве и периодичности визитов, времени, проведённом на сайте), а также об ID/типе операционной системы
        используемого Пользователем устройства, IP-адресе).
      </P>
      {AUTO}
      <P>
        2.5.5. Проведение исследований для понимания потребностей, мотивации и предпочтений Пользователей, их действий и
        использования функций Сервисов Сайта с целью улучшения качества и функциональности Сервисов Сайта. Для
        достижения данной цели обработке подлежат: идентификатор Пользователя, номер телефона, адрес электронной почты,
        фамилия, имя, отчество, пол, возраст, регион, город проживания, род занятости, информация об объявлениях,
        представленных на Сайте, наименование юридического лица (агентства, риелтора, партнёра риелтора).
      </P>
      {AUTO}
      <P>
        2.5.6. Выявление отзывов об оказанных услугах, оценка работы сотрудников для получения информации об исполнении
        заключённого с Пользователем договора по использованию Сервисов Сайта. Для достижения данной цели обработке
        подлежат: идентификатор Пользователя, адрес электронной почты, номер мобильного телефона, фамилия, имя
        Пользователя.
      </P>
      {AUTO}
      <P>
        2.5.7. Организация коммуникации между Пользователем и партнёрами Ten2Ten (застройщики, агентства недвижимости и
        др.). Для достижения данной цели обработке подлежат: ФИО, идентификатор Пользователя, адрес электронной почты,
        номер мобильного телефона, место работы, должность.
      </P>
      {AUTO}
      <P>
        2.5.8. Обеспечение возможности проведения консультаций, вебинаров, трансляций и иных аналогичных мероприятий от
        профессионалов в области недвижимости по вопросам поиска и подбора недвижимости, сбор обратной связи по итогам
        проведения таких мероприятий. Для достижения данной цели обработке подлежат: ФИО, идентификатор Пользователя,
        адрес электронной почты, номер телефона, место работы, должность, профессия, сведения об участии в мероприятиях
        (в том числе тема, дата, время проведения), фото- и/или видеоизображение, не используемое в целях идентификации.
      </P>
      {AUTO}
      <P>
        2.5.9. Организация клиентских мероприятий и встреч. Для достижения данной цели обработке подлежат: ФИО,
        идентификатор Пользователя, адрес электронной почты, номер мобильного телефона, место работы, должность,
        фото-/видеоизображение, не используемое в целях идентификации (в рамках записи онлайн-встреч).
      </P>
      {AUTO}
      <P>
        2.5.10. Обеспечение соблюдения Пользователями Пользовательского соглашения и достижение иных законных интересов
        Ten2Ten в рамках использования Сервисов Сайта (хранение сведений о Пользователях в течение сроков исковой
        давности, сведений о фактах нарушения Пользовательского соглашения и др.). Для достижения данной цели обработке
        подлежат: ФИО, идентификатор Пользователя, адрес электронной почты, номер мобильного телефона.
      </P>
      {AUTO}
      <P>
        2.6. Для достижения целей, определённых в настоящей Политике, Ten2Ten может осуществлять передачу персональных
        данных Пользователя третьим лицам. Передача персональных данных третьим лицам осуществляется в объёме,
        необходимом для целей их обработки. К третьим лицам, которым Ten2Ten может осуществлять передачу персональных
        данных Пользователя, относятся: риелторские агентства (при использовании услуги поиска риелтора), поставщики
        услуг связи, поставщики услуг рассылки информационных и рекламных материалов (в случае подписки Пользователя на
        указанные рассылки), партнёры, предоставляющие Ten2Ten услуги по использованию информационных и посреднических
        сервисов (в том числе при передаче заявок в кредитные организации по инициативе Пользователя), а также сервисов
        для проверки надёжности совершаемой Пользователем сделки, аффилированные лица Ten2Ten, лица, действующие по
        поручению Ten2Ten, иные третьи лица, передача данных которым необходима для выполнения обязательств Ten2Ten перед
        Пользователем в соответствии с настоящей Политикой. Передача персональных данных третьим лицам осуществляется в
        рамках заключённых с третьими лицами договоров, включающих обязательства о сохранении конфиденциальности
        полученных данных. Передача персональных данных может осуществляться, в том числе, на территории иностранных
        государств.
      </P>
      <P>
        2.7. При публикации на Сайте объявлений, отзывов, комментариев или вопросов, а также размещении иной информации в
        своём профиле, персональные данные в составе такой информации становятся доступными неопределённому кругу лиц.
        Пользователь уведомлён, что раскрывает такие данные самостоятельно без предоставления Ten2Ten как оператору
        персональных данных отдельного согласия. Ten2Ten осуществляет обработку таких персональных данных в целях
        исполнения договора (для использования функциональных возможностей Сайта) с Пользователем, заключённого по его
        инициативе.
      </P>
      <P>
        2.8. Обработка персональных данных Пользователя осуществляется в течение сроков действия, предусмотренных в
        {' '}{termsLink} и Лицензионном договоре, а также иных заключаемых с Пользователем договорах в процессе
        пользования Сайтами и/или мобильным приложением Ten2Ten. Для прекращения обработки персональных данных Ten2Ten
        Пользователю необходимо совершить действия, предусмотренные указанными выше документами, при этом персональные
        данные Пользователя могут обрабатываться и после этого в течение срока, необходимого для выполнения обязательств,
        возложенных на Ten2Ten в соответствии с законодательством Российской Федерации. В таком случае обработка
        персональных данных будет осуществляться в объёме, необходимом для соблюдения указанных обязательств.
      </P>

      <H>3. Принципы и способы обработки персональных данных</H>
      <P>3.1. При обработке персональных данных Ten2Ten руководствуется следующими принципами:</P>
      <UL>
        <li>обеспечение законности целей и способов обработки персональных данных;</li>
        <li>
          соответствие целей обработки персональных данных целям, заранее определённым и заявленным при сборе
          персональных данных;
        </li>
        <li>
          соответствие объёма и характера обрабатываемых персональных данных, а также способов обработки персональных
          данных целям обработки персональных данных;
        </li>
        <li>отсутствие избыточных персональных данных по отношению к заявленным при сборе персональных данных целям;</li>
        <li>обеспечение достоверности обрабатываемых персональных данных;</li>
        <li>использование раздельных баз данных для несовместимых целей обработки персональных данных.</li>
      </UL>
      <P>
        3.2. Обработка персональных данных Ten2Ten осуществляется как с использованием средств автоматизации, так и без
        использования средств автоматизации.
      </P>

      <H>4. Правила обработки персональных данных</H>
      <P>
        4.1. Персональные данные получаются непосредственно от Пользователей в процессе пользования Сайтами и мобильными
        приложениями Ten2Ten, за исключением случаев, предусмотренных Политикой, а также в иных заключаемых с
        Пользователем договорах в процессе пользования Сайтами Группы Ten2Ten, когда это прямо предусмотрено их
        условиями.
      </P>
      <P>
        4.2. Сбор персональных данных осуществляется с использованием Сайтов группы Ten2Ten, расположенных на территории
        Российской Федерации.
      </P>
      <P>
        4.3. В случаях, предусмотренных процессами обработки персональных данных в Ten2Ten, персональные данные могут
        быть переданы третьим лицам. Передача персональных данных третьим лицам может осуществляться с согласия
        Пользователя, а также в случаях, предусмотренных законодательством Российской Федерации, и на основании
        требований федеральных законов. Более подробная информация о третьих лицах, которым могут быть переданы
        персональные данные, а также об условиях, когда осуществляется передача персональных данных третьим лицам,
        приведена в Лицензионном соглашении, Договорах оферты и иных соглашениях, которые Пользователь принимает при
        обращении за услугами на Сайтах Группы Ten2Ten.
      </P>
      <P>
        4.4. Обработка персональных данных осуществляется в течение срока действия Лицензионного соглашения, иного
        Договора, соглашения по использованию сервисов Сайтов и мобильных приложений Ten2Ten, и сроков, установленных
        законодательством Российской Федерации.
      </P>

      <H>5. Обеспечение безопасности персональных данных</H>
      <P>
        5.1. Ten2Ten принимает все необходимые меры защиты, в том числе предусмотренные законодательством Российской
        Федерации, направленные на обеспечение конфиденциальности и безопасности персональных данных. К применяемым в
        Ten2Ten мерам защиты персональных данных в том числе относятся:
      </P>
      <UL>
        <li>назначено лицо, ответственное за обеспечение безопасности персональных данных в Ten2Ten;</li>
        <li>определены актуальные угрозы безопасности персональных данных;</li>
        <li>
          разработан и реализован комплекс мер защиты, обеспечивающий нейтрализацию актуальных угроз безопасности;
        </li>
        <li>определены правила обеспечения безопасности персональных данных при их обработке;</li>
        <li>осуществляется периодический контроль и оценка эффективности принимаемых мер защиты персональных данных.</li>
      </UL>

      <H>6. Права Пользователей в отношении своих персональных данных</H>
      <P>
        6.1. Пользователи в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных» имеют
        право:
      </P>
      <P>6.1.1. запрашивать сведения о своих обрабатываемых в Ten2Ten персональных данных, включая:</P>
      <UL>
        <li>подтверждение факта обработки персональных данных;</li>
        <li>правовые основания и цели обработки персональных данных;</li>
        <li>применяемые способы обработки персональных данных;</li>
        <li>
          полное наименование и место нахождения Ten2Ten, сведения о третьих лицах, которые имеют доступ к персональным
          данным или которым могут быть раскрыты персональные данные на основании договора с Ten2Ten или на основании
          федерального закона;
        </li>
        <li>состав обрабатываемых персональных данных и источник их получения;</li>
        <li>сроки обработки персональных данных, в том числе сроки их хранения;</li>
        <li>порядок осуществления прав субъекта персональных данных, предусмотренных законодательством;</li>
        <li>информацию об осуществлённой или о предполагаемой трансграничной передаче данных;</li>
        <li>
          наименование и адрес лица, осуществляющего обработку персональных данных по поручению Ten2Ten, если обработка
          поручена или будет поручена такому лицу;
        </li>
        <li>иные сведения, предусмотренные законодательством;</li>
      </UL>
      <P>6.1.2. требовать ознакомления с обрабатываемыми персональными данными;</P>
      <P>
        6.1.3. требовать уточнения персональных данных в случае, если они являются неполными, устаревшими или неточными;
      </P>
      <P>
        6.1.4. требовать блокирования персональных данных в случае, если они являются неполными, устаревшими или
        неточными, либо их обработка Ten2Ten является неправомерной;
      </P>
      <P>
        6.1.5. требовать уничтожения персональных данных в случае, если они являются незаконно полученными либо не
        являются необходимыми для заявленной цели обработки, либо в случае отзыва согласия на обработку персональных
        данных;
      </P>
      <P>
        6.1.6. требовать извещения Ten2Ten всех лиц, которым ранее были сообщены неверные или неполные персональные
        данные, обо всех произведённых в них исключениях, исправлениях или дополнениях;
      </P>
      <P>
        6.1.7. обжаловать в уполномоченный орган по защите прав субъектов персональных данных или в судебном порядке
        неправомерные действия или бездействия Ten2Ten при обработке и защите его персональных данных.
      </P>

      <H>7. Уточнение и уничтожение персональных данных</H>
      <P>
        7.1. Уточнение персональных данных осуществляется Пользователем самостоятельно с использованием функций Сайтов и
        мобильных приложений.
      </P>
      <P>7.2. Персональные данные, обрабатываемые Ten2Ten, подлежат уничтожению в следующих случаях:</P>
      <UL>
        <li>
          по достижении целей их обработки или в случае утраты необходимости в их достижении в срок, не превышающий
          тридцати дней с момента достижения цели обработки персональных данных, если иное не предусмотрено договором,
          стороной которого, выгодоприобретателем или поручителем по которому является субъект персональных данных, иным
          соглашением между Ten2Ten и субъектом персональных данных;
        </li>
        <li>
          в случае выявления неправомерной обработки персональных данных Ten2Ten в срок, не превышающий десяти рабочих
          дней с момента выявления неправомерной обработки персональных данных;
        </li>
        <li>
          в случае отзыва субъектом персональных данных согласия на обработку его персональных данных, если сохранение
          персональных данных более не требуется для целей обработки персональных данных, в срок, не превышающий
          тридцати дней с даты поступления указанного отзыва, если иное не предусмотрено договором, стороной которого,
          выгодоприобретателем или поручителем по которому является субъект персональных данных, иным соглашением между
          Ten2Ten и субъектом персональных данных;
        </li>
        <li>
          в случае истечения срока хранения персональных данных, определяемого в соответствии с законодательством
          Российской Федерации и организационно-распорядительными документами Ten2Ten;
        </li>
        <li>
          в случае предписания уполномоченного органа по защите прав субъектов персональных данных, Прокуратуры России
          или решения суда.
        </li>
      </UL>
      <P>
        7.3. Согласие на обработку персональных данных может быть отозвано Пользователем в любой момент. Для реализации
        права на отзыв Пользователь должен направить соответствующее обращение на адрес {mail}.
      </P>
      <P>
        7.4. Отзыв согласия Пользователя на обработку персональных данных не может являться основанием для прекращения
        обработки при наличии у Ten2Ten оснований, предусмотренных п. 2, 7, 10 части 1 ст. 6 Федерального закона от
        27.07.2006 № 152-ФЗ «О персональных данных».
      </P>

      <H>8. Контактная информация</H>
      <P>
        По вопросам обработки персональных данных: ООО «Тен2Тен», ИНН 9715532264, ОГРН 1267700290989, 127015, г. Москва,
        вн.тер.г. муниципальный округ Бутырский, ул. Новодмитровская, д. 2Б, электронная почта {mail}.
      </P>
    </main>
  );
}
