import LegalLayout, { Section } from '@/components/legal/LegalLayout';
import { SITE, LEGAL } from '@/lib/constants';

/**
 * Privacy Policy — India. Aligned to the Digital Personal Data Protection Act,
 * 2023 (DPDP) and the Information Technology Act, 2000 / SPDI Rules 2011.
 * Scope: the personal data actually collected by the waitlist form
 * (name, email, city, contribution interests, WhatsApp number, message).
 * NOT a substitute for review by a qualified Indian lawyer before launch.
 */
export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={`This policy explains what personal data ${SITE.name} collects when you join our waitlist, why we collect it, how we use and protect it, and the rights you have under India's Digital Personal Data Protection Act, 2023.`}
    >
      <Section n={1} title="Data Fiduciary">
        <p>
          For the purposes of the Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;),
          the Data Fiduciary is <strong>{LEGAL.companyName}</strong> (CIN: {LEGAL.cin}), registered
          office at {LEGAL.registeredAddress}. &quot;We&quot;, &quot;us&quot;, and &quot;our&quot;
          refer to this entity. For any privacy question, contact{' '}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
        </p>
      </Section>

      <Section n={2} title="What we collect">
        <p>When you join the waitlist, you may provide the following personal data:</p>
        <ul>
          <li>
            <strong>Full name</strong> and <strong>email address</strong> (required) — to identify
            you and contact you about the launch;
          </li>
          <li>
            <strong>City</strong> (optional) — to understand where interest is concentrated;
          </li>
          <li>
            <strong>How you&apos;d like to contribute</strong> (optional) — the interest options you
            select;
          </li>
          <li>
            <strong>WhatsApp number</strong> (optional) — only if you choose to share it, so we can
            reach you there;
          </li>
          <li>
            <strong>Message</strong> (optional) — anything you choose to write to us.
          </li>
        </ul>
        <p>
          We also automatically process limited technical data (such as your IP address and request
          metadata) for security, abuse prevention, and rate-limiting. We do not use tracking or
          advertising cookies on this website.
        </p>
      </Section>

      <Section n={3} title="Why we use it, and our legal basis">
        <p>
          We process your personal data on the basis of the <strong>consent</strong> you give by
          voluntarily submitting the waitlist form, for the following purposes:
        </p>
        <ul>
          <li>To add you to our launch waitlist and manage it;</li>
          <li>To notify you about our launch, updates, and how you can take part in the movement;</li>
          <li>
            To respond to your message and, where you have expressed interest, to discuss how you
            might contribute;
          </li>
          <li>To keep the service secure and prevent spam, fraud, and abuse;</li>
          <li>To comply with applicable legal obligations.</li>
        </ul>
        <p>
          We will not use your data for materially different purposes without seeking your consent
          again.
        </p>
      </Section>

      <Section n={4} title="Sharing and disclosure">
        <p>We do not sell your personal data. We may share it only with:</p>
        <ul>
          <li>
            <strong>Service providers (Data Processors)</strong> who help us run the website and
            waitlist — for example, hosting and database providers — under appropriate
            confidentiality and data-protection obligations, and only as needed to provide the
            service;
          </li>
          <li>
            <strong>Authorities</strong>, where disclosure is required by law, court order, or to
            protect our legal rights.
          </li>
        </ul>
        <p>
          Where any provider processes data outside India, we take reasonable steps to ensure the
          data is handled consistently with this policy and applicable law.
        </p>
      </Section>

      <Section n={5} title="How long we keep it">
        <p>
          We retain your waitlist data until the earlier of: (a) you ask us to delete it or withdraw
          your consent; or (b) it is no longer needed for the purposes above (for example, a
          reasonable period after launch). We may retain limited records for as long as required to
          comply with legal obligations or resolve disputes.
        </p>
      </Section>

      <Section n={6} title="Your rights">
        <p>Under the DPDP Act, subject to its conditions, you have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> a summary of the personal data we hold about you and how it is
            processed;
          </li>
          <li>
            <strong>Correct, complete, update, or erase</strong> your personal data;
          </li>
          <li>
            <strong>Withdraw consent</strong> at any time — this is as easy as giving it, and will
            not affect processing already carried out;
          </li>
          <li>
            <strong>Grievance redressal</strong> — raise a concern with us and have it addressed;
          </li>
          <li>
            <strong>Nominate</strong> another individual to exercise your rights in the event of
            death or incapacity.
          </li>
        </ul>
        <p>
          To exercise any of these, email{' '}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>. You can remove yourself
          from the waitlist at any time by contacting us.
        </p>
      </Section>

      <Section n={7} title="Grievance Officer">
        <p>
          In accordance with the DPDP Act and the Information Technology Act, 2000, you may contact
          our Grievance Officer for any complaint regarding the processing of your personal data:
        </p>
        <ul>
          <li>
            <strong>Grievance Officer:</strong> {LEGAL.grievanceOfficer}
          </li>
          <li>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${LEGAL.grievanceEmail}`}>{LEGAL.grievanceEmail}</a>
          </li>
          <li>
            <strong>Address:</strong> {LEGAL.companyName}, {LEGAL.registeredAddress}
          </li>
        </ul>
        <p>
          We will acknowledge and address grievances within the timelines required under applicable
          law. If you remain unsatisfied, you may escalate to the Data Protection Board of India.
        </p>
      </Section>

      <Section n={8} title="Children's data">
        <p>
          This waitlist is intended for adults. We do not knowingly collect personal data from
          children (individuals under 18). If you believe a child has provided us data, contact us
          and we will delete it.
        </p>
      </Section>

      <Section n={9} title="Security">
        <p>
          We implement reasonable security safeguards to protect your personal data against
          unauthorised access, disclosure, alteration, or loss, including access controls and
          encryption in transit. However, no method of transmission or storage is completely secure,
          and we cannot guarantee absolute security.
        </p>
      </Section>

      <Section n={10} title="Changes to this policy">
        <p>
          We may update this policy from time to time. When we make material changes, we will revise
          the &quot;Effective date&quot; above and, where appropriate, notify you. Please review this
          page periodically.
        </p>
      </Section>

      <Section n={11} title="Contact us">
        <p>
          For any question about this policy or your personal data, contact us at{' '}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a> or by post at{' '}
          {LEGAL.companyName}, {LEGAL.registeredAddress}.
        </p>
      </Section>
    </LegalLayout>
  );
}
