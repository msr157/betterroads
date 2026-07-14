/**
 * Regenerates src/lib/disposableDomains.generated.ts from the maintained
 * `disposable-email-domains` blocklist.
 *
 * Run: pnpm --filter @betterroads/backend run gen:disposable
 *
 * We vendor the list as a generated TS file (rather than an npm dependency) so
 * there's no runtime dependency, no lockfile churn, and the Docker build has
 * nothing extra to resolve. Re-run this periodically to pick up new providers.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SOURCE =
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'disposableDomains.generated.ts');

const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`Failed to fetch blocklist: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const raw = await res.text();

const domains = [
  ...new Set(
    raw
      .split(/\r?\n/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && !s.startsWith('#')),
  ),
].sort();

const file =
  `/* AUTO-GENERATED — do not edit by hand.\n` +
  ` * Source: https://github.com/disposable-email-domains/disposable-email-domains\n` +
  ` * Regenerate with: pnpm --filter @betterroads/backend run gen:disposable\n` +
  ` * ${domains.length} domains.\n` +
  ` */\n` +
  `export const DISPOSABLE_DOMAINS: string[] = ${JSON.stringify(domains)};\n`;

writeFileSync(OUT, file);
console.log(`Wrote ${domains.length} domains to ${OUT}`);
