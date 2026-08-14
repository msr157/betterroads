import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'mobile', 'app');
const signing = resolve(process.env.BETTERROADS_SIGNING_DIR ?? join(app, 'signing'));
for (const file of [join(signing, 'betterroads-upload.jks'), join(signing, 'keystore-password.txt')]) {
  if (!existsSync(file)) throw new Error(`Missing signing file: ${file}`);
}
const docker = spawnSync('docker', ['version'], { stdio: 'ignore' });
if (docker.status !== 0) throw new Error('Docker is required and must be running.');
mkdirSync(join(app, 'release'), { recursive: true });
const image = process.env.BETTERROADS_ANDROID_IMAGE ?? 'reactnativecommunity/react-native-android:latest';
const channel = process.env.BETTERROADS_RELEASE_CHANNEL === 'test' ? 'test' : 'stable';
const args = ['run', '--rm', '-e', `EXPO_PUBLIC_RELEASE_CHANNEL=${channel}`, '-e', `BETTERROADS_RELEASE_CHANNEL=${channel}`, '-v', `${app}:/proj`, '-v', `${signing}:/signing:ro`, '-v', 'betterroads-gradle-cache:/root/.gradle', '-w', '/proj', image, 'bash', '/proj/build-release.sh'];
console.log(`Building BetterRoads Android ${channel} release with ${image}`);
const result = spawnSync('docker', args, { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Signed APK and AAB written to ${join(app, 'release')}`);
