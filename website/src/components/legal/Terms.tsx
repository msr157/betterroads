import LegalLayout, { Section } from '@/components/legal/LegalLayout';
import { SITE, LEGAL } from '@/lib/constants';

/**
 * Terms of Service — India. Written for the current pre-launch phase: a
 * waitlist / teaser site (no app or paid service yet). Governed by Indian law
 * incl. the Information Technology Act, 2000. NOT a substitute for review by a
 * qualified Indian lawyer before launch.
 */
export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={`These terms govern your use of the ${SITE.name} website and the pre-launch waitlist. Please read them carefully. By using this website or joining the waitlist, you agree to these terms.`}
    >
      <Section n={1} title="Who we are">
        <p>
          This website is operated by <strong>{LEGAL.companyName}</strong>, a company
          incorporated in India (CIN: {LEGAL.cin}), with its registered office at{' '}
          {LEGAL.registeredAddress} (&quot;{SITE.name}&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;). You can reach us at{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
      </Section>

      <Section n={2} title="What this website is">
        <p>
          {SITE.name} is a citizen movement working towards better roads in India. At present this
          website is a <strong>pre-launch and waitlist page</strong>. It lets you learn about the
          project and register your interest to be notified when we launch. The product and app
          described here are <strong>not yet available</strong>, and features, timelines, and the
          launch date (currently 15 August 2026) may change or be cancelled without notice.
        </p>
      </Section>

      <Section n={3} title="Eligibility">
        <p>
          You must be at least 18 years old, or the age of majority in your jurisdiction, to join
          the waitlist and provide personal information. By using this website you confirm that the
          information you provide is true, accurate, and your own.
        </p>
      </Section>

      <Section n={4} title="The waitlist">
        <ul>
          <li>
            Joining the waitlist is voluntary and free. It does not create any contract for goods or
            services, nor guarantee access to the product at launch.
          </li>
          <li>
            You agree to provide accurate details and not to submit false information, impersonate
            others, or register on someone else&apos;s behalf without permission.
          </li>
          <li>
            We may use the details you provide to contact you about the launch and the movement, as
            described in our{' '}
            <a href="/privacy">Privacy Policy</a>.
          </li>
          <li>You can ask us to remove you from the waitlist at any time (see the Privacy Policy).</li>
        </ul>
      </Section>

      <Section n={5} title="Acceptable use">
        <p>When using this website, you agree that you will not:</p>
        <ul>
          <li>Use it for any unlawful purpose or in violation of any applicable Indian law;</li>
          <li>
            Attempt to gain unauthorised access to, probe, scan, or disrupt the website, its
            servers, or its infrastructure;
          </li>
          <li>Introduce malware, or attempt to overload or interfere with the service;</li>
          <li>Scrape, harvest, or collect data about other users;</li>
          <li>Copy, reproduce, or exploit any part of the website except as expressly permitted.</li>
        </ul>
      </Section>

      <Section n={6} title="Intellectual property">
        <p>
          The {SITE.name} name, logo, wordmark, content, design, and graphics on this website are
          owned by or licensed to us and are protected under applicable intellectual property laws.
          You may not use them without our prior written permission. Third-party names and marks
          (for example, embedded video from YouTube) belong to their respective owners.
        </p>
      </Section>

      <Section n={7} title="Third-party links and content">
        <p>
          This website may link to or embed third-party content and services (such as social media
          profiles and video platforms). We do not control and are not responsible for third-party
          content, and your use of such services is governed by their own terms and privacy
          policies.
        </p>
      </Section>

      <Section n={8} title="Disclaimers">
        <p>
          This website is provided on an &quot;as is&quot; and &quot;as available&quot; basis,
          without warranties of any kind, whether express or implied, to the maximum extent
          permitted by law. We do not warrant that the website will be uninterrupted, error-free, or
          secure. Any information presented (including statistics about roads) is for general
          informational purposes and may be provisional or subject to verification.
        </p>
      </Section>

      <Section n={9} title="Limitation of liability">
        <p>
          To the maximum extent permitted by applicable law, {SITE.name} and its founders,
          employees, and affiliates shall not be liable for any indirect, incidental, special, or
          consequential loss or damage arising out of or in connection with your use of, or
          inability to use, this website.
        </p>
      </Section>

      <Section n={10} title="Changes to these terms">
        <p>
          We may update these terms from time to time. When we do, we will revise the &quot;Effective
          date&quot; above. Your continued use of the website after changes take effect constitutes
          your acceptance of the revised terms.
        </p>
      </Section>

      <Section n={11} title="Governing law and jurisdiction">
        <p>
          These terms are governed by and construed in accordance with the laws of India. Subject to
          applicable law, the courts at {LEGAL.governingLawCity}, {LEGAL.governingLawState}, India
          shall have exclusive jurisdiction over any dispute arising out of or relating to these
          terms or this website.
        </p>
      </Section>

      <Section n={12} title="Contact us">
        <p>
          Questions about these terms? Write to us at{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>, or by post at{' '}
          {LEGAL.companyName}, {LEGAL.registeredAddress}.
        </p>
      </Section>
    </LegalLayout>
  );
}
