import { statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const apk = process.argv[2];
if (!apk) throw new Error('Usage: node analyze-apk.mjs <apk>');
const size = statSync(apk).size;
const listing = spawnSync('unzip', ['-l', apk], { encoding: 'utf8' });
if (listing.status !== 0) throw new Error(listing.stderr || 'Unable to inspect APK');
const entries = listing.stdout.split('\n').map((line) => {
  const match = line.match(/^\s*(\d+)\s+\S+\s+\S+\s+(.+)$/);
  return match ? { bytes: Number(match[1]), name: match[2].trim() } : null;
}).filter(Boolean);
const groups = new Map();
for (const { bytes, name } of entries) {
  const group = name.startsWith('lib/') ? `native:${name.split('/')[1]}`
    : name.endsWith('.dex') ? 'DEX'
      : name.includes('index.android.bundle') ? 'JavaScript'
        : /\.(ttf|otf)$/.test(name) ? 'fonts'
          : name.startsWith('res/') ? 'resources'
            : 'other';
  groups.set(group, (groups.get(group) ?? 0) + bytes);
}
const mib = (n) => `${(n / 1024 / 1024).toFixed(2)} MiB`;
console.log(`APK: ${apk} (${mib(size)})`);
for (const [group, bytes] of [...groups].sort((a, b) => b[1] - a[1])) console.log(`${group.padEnd(22)} ${mib(bytes)}`);
if (entries.some(({ name }) => /^lib\/(x86|x86_64)\//.test(name))) throw new Error('APK contains forbidden x86 libraries.');
if (size >= 50 * 1024 * 1024) throw new Error(`APK exceeds the 50 MiB release limit: ${mib(size)}.`);
