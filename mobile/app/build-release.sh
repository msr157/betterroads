#!/bin/bash
# Runs INSIDE the react-native-android container. Mounts:
#   /proj    = mobile/app source (no node_modules)
#   /signing = upload keystore + password
# Produces app-release.aab + app-release.apk in /proj/android/app/build/outputs/.
set -euo pipefail
cd /proj
export CI=1
export GRADLE_OPTS="-Xmx2200m -XX:MaxMetaspaceSize=512m"

yes | sdkmanager --licenses >/dev/null 2>&1 || true

npm ci --no-audit --no-fund
npx expo prebuild --platform android --no-install

cp /signing/betterroads-upload.jks android/app/
PW=$(cat /signing/keystore-password.txt | tr -d '\r\n')
cat >> android/gradle.properties <<EOF
org.gradle.daemon=false
org.gradle.workers.max=2
org.gradle.jvmargs=-Xmx2200m -XX:MaxMetaspaceSize=512m
kotlin.daemon.jvmargs=-Xmx1024m
BR_UPLOAD_STORE_FILE=betterroads-upload.jks
BR_UPLOAD_KEY_ALIAS=betterroads-upload
BR_UPLOAD_STORE_PASSWORD=$PW
BR_UPLOAD_KEY_PASSWORD=$PW
EOF

node - <<'JS'
const fs = require('fs');
const p = 'android/app/build.gradle';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/signingConfigs\s*\{\s*\n(\s*)debug\s*\{/, (m, ind) =>
  m.replace(/debug\s*\{$/,
`release {
${ind}    storeFile file(BR_UPLOAD_STORE_FILE)
${ind}    storePassword BR_UPLOAD_STORE_PASSWORD
${ind}    keyAlias BR_UPLOAD_KEY_ALIAS
${ind}    keyPassword BR_UPLOAD_KEY_PASSWORD
${ind}}
${ind}debug {`));
let patched = false;
s = s.replace(/release\s*\{([^}]*?)signingConfig signingConfigs\.debug/, (m, body) => {
  patched = true;
  return `release {${body}signingConfig signingConfigs.release`;
});
if (!patched) throw new Error('release buildType signing patch failed');
fs.writeFileSync(p, s);
console.log('signing config patched');
JS

cd android
./gradlew --no-daemon :app:bundleRelease :app:assembleRelease
echo "══════ ARTIFACTS ══════"
ls -la app/build/outputs/bundle/release/ app/build/outputs/apk/release/
