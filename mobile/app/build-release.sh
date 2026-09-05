#!/bin/bash
# Runs INSIDE the react-native-android container. Mounts:
#   /proj    = mobile/app source (no node_modules)
#   /signing = upload keystore + password
# Produces app-release.aab + app-release.apk in /proj/android/app/build/outputs/.
set -euo pipefail
cd /proj
export CI=1
export NODE_ENV=production
export GRADLE_OPTS="-Xmx3g -XX:MaxMetaspaceSize=1g"
export NODE_OPTIONS="--max-old-space-size=4096"

yes | sdkmanager --licenses >/dev/null 2>&1 || true

# Clean any leftover build artefacts from prior runs (avoids ENOTEMPTY on npm ci
# when the source tree is mounted from a Windows host and Gradle/CMake outputs persist).
find /proj/node_modules -name "build" -maxdepth 5 -type d -exec rm -rf {} + 2>/dev/null || true
find /proj/node_modules -name ".cxx" -maxdepth 5 -type d -exec rm -rf {} + 2>/dev/null || true

npm ci --no-audit --no-fund
npx expo prebuild --clean --platform android --no-install

cp /signing/betterroads-upload.jks android/app/
PW=$(cat /signing/keystore-password.txt | tr -d '\r\n')
# Ensure a trailing newline before appending — expo prebuild omits it,
# which causes our properties to concatenate onto the last line and
# corrupt Gradle's node subprocess argument parsing.
printf '\n' >> android/gradle.properties
cat >> android/gradle.properties <<EOF
org.gradle.daemon=false
org.gradle.workers.max=2
org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g
kotlin.daemon.jvmargs=-Xmx1g
BR_UPLOAD_STORE_FILE=betterroads-upload.jks
BR_UPLOAD_KEY_ALIAS=betterroads-upload
BR_UPLOAD_STORE_PASSWORD=$PW
BR_UPLOAD_KEY_PASSWORD=$PW
reactNativeArchitectures=armeabi-v7a,arm64-v8a
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
expo.gif.enabled=false
expo.webp.animated=false
EOF

node patch-android-release.mjs android/app/build.gradle

# lintVital* is skipped: it re-analyzes every library module (metaspace-heavy)
# and gates nothing we ship — this is a sideload/Play upload, not a lint gate.
cd android
./gradlew --no-daemon --max-workers 2 :app:bundleRelease :app:assembleRelease \
  -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease

# Name the artifacts properly: BetterRoads-v<version>_<timestamp>.apk / .aab
VERSION=$(node -p "require('/proj/app.json').expo.version")
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CHANNEL=${BETTERROADS_RELEASE_CHANNEL:-stable}
mkdir -p /proj/release
if [ "$CHANNEL" = "test" ]; then
  cp app/build/outputs/apk/release/app-release.apk "/proj/release/BetterRoads-Test-v${VERSION}_${TIMESTAMP}.apk"
  cp app/build/outputs/bundle/release/app-release.aab "/proj/release/BetterRoads-Test-v${VERSION}_${TIMESTAMP}.aab"
  cp app/build/outputs/apk/release/app-release.apk "/proj/release/BetterRoads-Test.apk"
else
  cp app/build/outputs/apk/release/app-release.apk "/proj/release/BetterRoads-v${VERSION}_${TIMESTAMP}.apk"
  cp app/build/outputs/bundle/release/app-release.aab "/proj/release/BetterRoads-v${VERSION}_${TIMESTAMP}.aab"
  cp app/build/outputs/apk/release/app-release.apk "/proj/release/BetterRoads.apk"
fi
node /proj/analyze-apk.mjs app/build/outputs/apk/release/app-release.apk
echo "══════ ARTIFACTS ══════"
ls -la /proj/release/
