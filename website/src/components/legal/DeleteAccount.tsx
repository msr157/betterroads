import LegalLayout, { Section } from '@/components/legal/LegalLayout';
import { LEGAL } from '@/lib/constants';

export default function DeleteAccount() {
  return <LegalLayout title="Delete your BetterRoads account" intro="You can permanently remove your BetterRoads profile and account links from the Android app or request help from our privacy team.">
    <Section n={1} title="Delete in the app"><ol><li>Open BetterRoads and sign in.</li><li>Tap <strong>Profile</strong>.</li><li>Tap <strong>Delete account</strong> and confirm.</li></ol></Section>
    <Section n={2} title="If you cannot access the app"><p>Email <a href={`mailto:${LEGAL.privacyEmail}?subject=BetterRoads%20account%20deletion`}>{LEGAL.privacyEmail}</a> from the Google email used for your account. We may verify ownership before completing the request.</p></Section>
    <Section n={3} title="What is deleted"><p>Your profile, login sessions, and links between your account and contributed journeys/devices are removed. Your name immediately disappears from contribution rankings.</p><p>Anonymized road measurements may remain because they form part of the public road-condition dataset and no longer identify or link back to your account.</p></Section>
  </LegalLayout>;
}
