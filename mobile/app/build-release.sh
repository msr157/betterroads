#!/bin/bash
# Runs INSIDE the react-native-android container. Mounts:
#   /proj    = mobile/app source (no node_modules)
#   /signing = upload keystore + password
# Produces app-release.aab + app-release.apk in /proj/android/app/build/outputs/.
set -euo pipefail
cd /proj
export CI=1
export GRADLE_OPTS="-Xmx1500m -XX:MaxMetaspaceSize=384m"
export NODE_OPTIONS="--max-old-space-size=4096"

yes | sdkmanager --licenses >/dev/null 2>&1 || true

# Clean any leftover build artefacts from prior runs (avoids ENOTEMPTY on npm ci
# when the source tree is mounted from a Windows host and Gradle/CMake outputs persist).
find /proj/node_modules -name "build" -maxdepth 5 -type d -exec rm -rf {} + 2>/dev/null || true
find /proj/node_modules -name ".cxx" -maxdepth 5 -type d -exec rm -rf {} + 2>/dev/null || true

npm ci --no-audit --no-fund
npx expo prebuild --platform android --no-install

cp /signing/betterroads-upload.jks android/app/
PW=$(cat /signing/keystore-password.txt | tr -d '\r\n')
# Ensure a trailing newline before appending — expo prebuild omits it,
# which causes our properties to concatenate onto the last line and
# corrupt Gradle's node subprocess argument parsing.
printf '\n' >> android/gradle.properties
cat >> android/gradle.properties <<EOF
org.gradle.daemon=false
org.gradle.workers.max=1
org.gradle.jvmargs=-Xmx1500m -XX:MaxMetaspaceSize=384m
kotlin.daemon.jvmargs=-Xmx768m
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
./gradlew --no-daemon --max-workers 1 :app:bundleRelease :app:assembleRelease

# Name the artifacts properly: BetterRoads-v<version>.apk / .aab
VERSION=$(node -p "require('/proj/app.json').expo.version")
mkdir -p /proj/release
cp app/build/outputs/apk/release/app-release.apk "/proj/release/BetterRoads-v${VERSION}.apk"
cp app/build/outputs/bundle/release/app-release.aab "/proj/release/BetterRoads-v${VERSION}.aab"
echo "══════ ARTIFACTS ══════"
ls -la /proj/release/
