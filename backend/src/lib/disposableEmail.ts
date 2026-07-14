/**
 * Disposable / temporary email detection + deliverability checks.
 *
 * Two independent layers, both best-effort and dependency-free:
 *
 *  1. isDisposableEmail() — domain blocklist. Uses the maintained
 *     `disposable-email-domains` list (~8k domains, vendored as a generated
 *     file) plus a small local extras set. Synchronous, O(1) lookup, matches
 *     the exact domain AND its subdomains.
 *
 *  2. hasMailExchanger() — DNS check that the domain can actually receive mail
 *     (has MX, or a fallback A/AAAA record per RFC 5321). Async, catches
 *     typo/garbage domains that pass a syntactic check but can't receive email.
 *
 * Neither is perfect on its own; together they stop the overwhelming majority
 * of throwaway and undeliverable signups without an external paid API.
 */
import { resolveMx, resolve4, resolve6 } from 'node:dns/promises';
import { DISPOSABLE_DOMAINS } from './disposableDomains.generated.js';

// Maintained list (generated) + a few local extras / early catches. Kept as a
// Set for O(1) lookup.
const LOCAL_EXTRAS = [
  'mailinator.com',
  'guerrillamail.com',
  'yopmail.com',
  '10minutemail.com',
  'temp-mail.org',
] as const;

const BLOCKED_DOMAINS = new Set<string>([...DISPOSABLE_DOMAINS, ...LOCAL_EXTRAS]);

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

/**
 * True when the email's domain can plausibly receive mail — it has at least one
 * MX record, or (per RFC 5321 §5) a fallback A/AAAA record. Rejects typo /
 * non-existent domains like `gmial.com` or `asdf@nowhere.invalid`.
 *
 * Fails OPEN on transient DNS errors (timeouts, SERVFAIL) so a flaky resolver
 * never blocks a legitimate signup — only a confirmed "no mail host" returns
 * false. Callers should apply their own timeout if needed.
 */
export async function hasMailExchanger(email: string): Promise<boolean> {
  const domain = domainOf(email);
  if (!domain) return false;

  try {
    const mx = await resolveMx(domain);
    if (mx.length > 0 && mx.some((r) => r.exchange)) return true;
  } catch (err) {
    if (!isNxDomain(err)) return true; // transient error → don't block
  }

  // No MX — RFC 5321 allows falling back to an A/AAAA record as the mail host.
  try {
    const a = await resolve4(domain);
    if (a.length > 0) return true;
  } catch (err) {
    if (!isNxDomain(err)) return true;
  }

  try {
    const aaaa = await resolve6(domain);
    if (aaaa.length > 0) return true;
  } catch (err) {
    if (!isNxDomain(err)) return true;
  }

  return false;
}

/** A definitive "this name does not exist / has no such record" DNS result. */
function isNxDomain(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN';
}

/** Exposed for tests / admin tooling. */
export { BLOCKED_DOMAINS };
