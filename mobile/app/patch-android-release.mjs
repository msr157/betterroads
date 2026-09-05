import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2] ?? 'android/app/build.gradle';
let source = readFileSync(path, 'utf8');

source = source.replace(/signingConfigs\s*\{\s*\n(\s*)debug\s*\{/, (match, indent) =>
  match.replace(/debug\s*\{$/, `release {
${indent}    storeFile file(BR_UPLOAD_STORE_FILE)
${indent}    storePassword BR_UPLOAD_STORE_PASSWORD
${indent}    keyAlias BR_UPLOAD_KEY_ALIAS
${indent}    keyPassword BR_UPLOAD_KEY_PASSWORD
${indent}}
${indent}debug {`));

let signingPatched = false;
source = source.replace(/release\s*\{([^}]*?)signingConfig signingConfigs\.debug/, (_match, body) => {
  signingPatched = true;
  return `release {${body}signingConfig signingConfigs.release`;
});
if (!signingPatched) throw new Error('Release buildType signing patch failed.');

source = source.replace(/defaultConfig\s*\{/, `defaultConfig {
        ndk { abiFilters "armeabi-v7a", "arm64-v8a" }`);
source = source.replace(/(buildTypes\s*\{[\s\S]*?)release\s*\{/, `$1release {
            minifyEnabled true
            shrinkResources true`);
source += '\nandroid.packagingOptions.jniLibs.useLegacyPackaging = false\n';

for (const required of [
  'abiFilters "armeabi-v7a", "arm64-v8a"',
  'minifyEnabled true',
  'shrinkResources true',
  'signingConfig signingConfigs.release',
  'useLegacyPackaging = false',
]) {
  if (!source.includes(required)) throw new Error(`Generated Gradle validation failed: ${required}`);
}

writeFileSync(path, source);
console.log('Release signing, ARM ABI, R8 and packaging config patched.');
