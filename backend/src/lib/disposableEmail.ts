/**
 * Disposable / temporary email detection.
 *
 * Blocks signups from throwaway inbox providers (10minutemail, mailinator,
 * guerrillamail, etc.). This is a best-effort curated blocklist — it will not
 * catch every disposable provider (thousands exist and new ones appear daily),
 * but it stops the overwhelming majority of casual throwaway addresses without
 * an external API dependency.
 *
 * Extend BLOCKED_DOMAINS as new providers surface. Matching is done on the
 * exact registered domain AND its subdomains (so `foo.mailinator.com` is also
 * blocked), case-insensitively.
 */

// Curated set of common disposable-email domains. Kept as a Set for O(1) lookup.
const BLOCKED_DOMAINS = new Set<string>([
  '0-mail.com',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  '33mail.com',
  'anonbox.net',
  'burnermail.io',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxbear.com',
  'inboxkitten.com',
  'jetable.org',
  'mail-temp.com',
  'mail7.io',
  'mailcatch.com',
  'maildrop.cc',
  'mailexpire.com',
  'mailforspam.com',
  'mailimate.com',
  'mailinator.com',
  'mailnesia.com',
  'mailsac.com',
  'mailtemp.info',
  'mintemail.com',
  'mohmal.com',
  'moakt.com',
  'mytemp.email',
  'nada.email',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempinbox.com',
  'tempmail.com',
  'tempmail.dev',
  'tempmail.plus',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'wegwerfmail.de',
  'yopmail.com',
  'yopmail.net',
  'zetmail.com',
]);

/**
 * Returns the lowercased domain of an email, or null if it has no `@domain`.
 */
function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * True when the email's domain is a known disposable/temporary provider.
 * Matches the exact domain and any subdomain of a blocked domain.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = domainOf(email);
  if (!domain) return false;

  if (BLOCKED_DOMAINS.has(domain)) return true;

  // Subdomain match: `mail.mailinator.com` → check `mailinator.com`, etc.
  const labels = domain.split('.');
  for (let i = 1; i < labels.length - 1; i++) {
    if (BLOCKED_DOMAINS.has(labels.slice(i).join('.'))) return true;
  }

  return false;
}

/** Exposed for tests / admin tooling. */
export { BLOCKED_DOMAINS };
