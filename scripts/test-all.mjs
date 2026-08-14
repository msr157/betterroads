import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), '--test', 'src/**/*.test.ts'], join(root, 'backend'));
run(process.execPath, [join(root, 'mobile', 'app', 'node_modules', 'tsx', 'dist', 'cli.mjs'), '--test', 'src/**/*.test.ts'], join(root, 'mobile', 'app'));
const localPython = process.platform === 'win32'
  ? join(root, 'ai', '.venv', 'Scripts', 'python.exe')
  : join(root, 'ai', '.venv', 'bin', 'python');
run(existsSync(localPython) ? localPython : (process.platform === 'win32' ? 'python' : 'python3'), ['-m', 'pytest', 'ai/tests']);
