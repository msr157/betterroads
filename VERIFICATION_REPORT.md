# Android Background Recording Implementation Verification

**Branch:** `fix/android-background-recording`  
**Verification Date:** October 2, 2026  
**Verified By:** Claude (Opus 5)

---

## Claim-by-Claim Verification

### ✅ VERIFIED: Android uses native foreground service for GPS, accelerometer, gyroscope, wake lock, persistent notification, and screen-off recording

**Evidence:**

1. **Native Foreground Service Exists**
   - File: `mobile/app/modules/road-recorder/android/src/main/java/org/betterroads/recorder/RecordingService.kt`
   - Service properly declared in `AndroidManifest.xml` with `foregroundServiceType="location"`
   - Service implements `SensorEventListener` and `LocationListener`

2. **GPS Recording**
   - Line 80: `locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, thread.looper)`
   - Location updates captured at 1Hz

3. **Accelerometer & Gyroscope**
   - Lines 66-67: Both sensors registered with 20ms interval (50Hz)
   - Lines 78-79: `sensors.registerListener()` for both accelerometer and gyroscope
   - Samples written to journal in `onSensorChanged()` callback

4. **Wake Lock**
   - Lines 73-76: Partial wake lock acquired with bounded duration
   - Type: `PowerManager.PARTIAL_WAKE_LOCK`
   - Tag: `"BetterRoads:Journey"`
   - Properly released on service finish (line 151)

5. **Persistent Notification**
   - Lines 47-54: Notification builder with ongoing flag
   - Lines 61-63: Service started with `startForeground()` and `FOREGROUND_SERVICE_TYPE_LOCATION`
   - Stop action built into notification
   - Channel: "Journey recording" (IMPORTANCE_LOW)

6. **Android Manifest Permissions**
   - `ACCESS_FINE_LOCATION` ✓
   - `FOREGROUND_SERVICE` ✓
   - `FOREGROUND_SERVICE_LOCATION` ✓
   - `WAKE_LOCK` ✓
   - `POST_NOTIFICATIONS` ✓

7. **Screen-Off Recording**
   - Service owns hardware listeners independently of Activity lifecycle
   - Partial wake lock prevents CPU sleep during recording
   - Notification makes service user-visible (Android requirement)

---

### ✅ VERIFIED: Samples are journaled safely, replayed after reopening, and retained through crashes or offline upload

**Evidence:**

1. **Safe Journal Storage**
   - File: `RoadRecorderModule.kt`, line 17
   - Location: `context.noBackupFilesDir/road-recording/`
   - Files: `session.json` (metadata) + `samples.jsonl` (newline-delimited samples)
   - Atomic write using `android.util.AtomicFile` (lines 22-25)
   - Synced to disk every 1 second (line 133: `output?.fd?.sync()`)

2. **Crash-Resilient Journal Format**
   - Newline-delimited JSON (one sample per line)
   - Partial final line ignored during replay (lines 73-75 in `RoadRecorderModule.kt`)
   - Service is `START_NOT_STICKY` - no silent restarts (lines 58, 59, 85 in `RecordingService.kt`)

3. **Replay After Reopening**
   - File: `mobile/app/src/journeyRecorder.ts`
   - Lines 59-77: `JourneyRecorder.recover()` static method
   - Called from `App.tsx` line 108 during app launch
   - Verifies owner matches current user (line 62)
   - Syncs native journal incrementally (line 75)

4. **Bounded Page-Based Replay**
   - File: `mobile/app/src/collection/journalReplay.ts`
   - Lines 19-36: `drainJournal()` function
   - Reads 1000 rows per page
   - Advances offset only after full page consumed
   - Handles corrupt/incomplete records gracefully

5. **Retention Through Crashes**
   - Native service writes to no-backup storage (survives app crashes)
   - Journal not deleted until upload queue written (see next section)
   - Process death comment: line 335 in `journeyRecorder.ts`
   - Recovery flow: Lines 107-120 in `App.tsx`

---

### ✅ VERIFIED: Upload data is durably queued before the native journal is cleared

**Evidence:**

1. **Queue-Then-Clear Pattern**
   - File: `mobile/app/src/collection/queue.ts`
   - Lines 143-149: Queue written first, verified with `hasQueuedCollection()`
   - Line 149: `await onSaved?.()` callback invoked AFTER queue write succeeds
   - This callback is `recorder.acknowledgeSaved()` which clears the journal

2. **Upload Flow in App.tsx**
   - Line 282: `uploadCollectionOrQueue(prepared, () => recorder.acknowledgeSaved())`
   - The callback parameter is the key: journal only cleared after queue write

3. **acknowledgeSaved Implementation**
   - File: `journeyRecorder.ts`, lines 117-119
   - Calls `nativeRecorder().clear(this.native.id)`
   - Only invoked after queue write succeeds

4. **Queue Directory**
   - Location: `Paths.document/pending-collections-v3/`
   - Per-session JSON manifest + raw subdirectory
   - Bound to user ID (cross-account isolation)

5. **Offline Safety**
   - If upload fails, queue remains and journal is NOT cleared
   - Only successful upload (or terminal rejection) triggers journal deletion
   - Lines 152-157 in `queue.ts`: Only delete on 'received', 'quarantined', or 'rejected'

---

### ✅ VERIFIED: Permissions, UI instructions, Android manifest, version 1.4.0, and documentation were updated

**Evidence:**

1. **Permission Requests**
   - File: `journeyRecorder.ts`, lines 140-151
   - Requests `Location.requestForegroundPermissionsAsync()`
   - Android 13+: Requests `POST_NOTIFICATIONS` permission (lines 144-146)
   - Returns false if either denied

2. **Android Manifest Updated**
   - File: `mobile/app/modules/road-recorder/android/src/main/AndroidManifest.xml`
   - All required permissions declared (lines 2-6)
   - Service registered with `foregroundServiceType="location"` (line 8)
   - Service properly configured: `exported="false"`, `stopWithTask="false"`

3. **UI Instructions**
   - File: `mobile/app/src/components/JourneyDashboard.tsx`
   - Line 447: "Tap Start Journey, then lock the screen if you need to. Android keeps recording through its visible foreground service."
   - Line 475: "After starting a journey, you can lock the screen. Recording continues until you end the journey or Android interrupts it."
   - Platform-specific instructions shown only on Android

4. **Version 1.4.0**
   - File: `mobile/app/app.json`, line 5: `"version": "1.4.0"`
   - File: `mobile/app/app.json`, line 22: `"versionCode": 4` (Android)
   - File: `mobile/app/src/config.ts`, line 10: `export const APP_VERSION = '1.4.0';`

5. **Documentation Created**
   - File: `docs/ANDROID_BACKGROUND_RECORDING.md` (43 lines)
   - Covers: service architecture, start/stop contract, recovery, upload safety
   - Includes release checklist for physical device testing
   - Documents 15-minute screen-locked test requirement

6. **Modified Files** (from git status)
   - `mobile/app/app.json` - Version bump
   - `mobile/app/src/config.ts` - APP_VERSION
   - `mobile/app/src/journeyRecorder.ts` - Native integration
   - `mobile/app/App.tsx` - Recovery flow
   - `mobile/app/src/components/JourneyDashboard.tsx` - UI instructions
   - `mobile/app/.gitignore` - Exclude native build artifacts

7. **New Files Created**
   - `mobile/app/modules/road-recorder/` - Native module directory
   - `mobile/app/src/collection/journalReplay.ts` - Replay logic
   - `mobile/app/src/collection/nativeRecording.ts` - Bridge interface
   - `docs/ANDROID_BACKGROUND_RECORDING.md` - Documentation

---

### ✅ VERIFIED: iOS remains foreground-only

**Evidence:**

1. **Platform-Specific Start Logic**
   - File: `journeyRecorder.ts`, lines 154-206
   - Line 156: `if (Platform.OS === 'android')` guards native service path
   - Lines 173-205: Fallback path uses Expo's foreground listeners
   - iOS uses `Accelerometer.addListener()` and `Location.watchPositionAsync()` directly
   - No native service, no wake lock, no journal on iOS

2. **Native Module Availability**
   - File: `nativeRecording.ts`, line 23
   - `const module = Platform.OS === 'android' ? requireOptionalNativeModule(...) : null`
   - iOS returns null, native recorder unavailable

3. **Recovery iOS Guard**
   - File: `journeyRecorder.ts`, lines 59-77
   - Native session only retrieved on Android
   - Line 29 in `nativeRecording.ts`: `if (Platform.OS !== 'android') return null`

---

## Additional Implementation Quality Checks

### ✅ Safety Limits Implemented

1. **12-Hour Duration Limit**
   - `RecordingService.kt`, line 22: `MAX_DURATION_MS = 12L * 60 * 60 * 1000`
   - Checked in health loop (line 135)

2. **256MB Storage Limit**
   - Line 21: `MAX_BYTES = 256L * 1024 * 1024`
   - Checked before appending (line 90)

3. **Sensor Health Monitoring**
   - Lines 136-137: Fails if accelerometer or gyroscope stop for >15 seconds
   - GPS waiting state reported without failing

### ✅ Resource Cleanup

1. **On Service Stop**
   - Line 145: Unregister sensor listeners
   - Line 146: Remove location updates
   - Line 147: Remove health callbacks
   - Lines 148-149: Sync and close file output
   - Line 151: Release wake lock
   - Line 160: Stop foreground + remove notification

2. **Cross-Account Protection**
   - `journeyRecorder.ts`, lines 62-67
   - Prevents user A from resuming user B's journey
   - Stops service if owner mismatch detected

### ✅ Error Handling

1. **Service Start Failures**
   - Caught and recorded as `session.error` in metadata
   - Notification shown to user (lines 161-162 in `RecordingService.kt`)
   - Journal retained for later recovery

2. **GPS Provider Disabled**
   - Line 124: `onProviderDisabled()` immediately stops service
   - Marked as interrupted, not silently failed

### ✅ Testing Instructions Provided

Documentation includes checklist for:
- 15-minute screen-locked test
- App switching and recovery
- Stop from app vs notification
- Permission revocation scenarios
- Offline completion and upload verification

---

## Files Changed Summary

### Modified (9 files)
1. `mobile/app/app.json` - Version 1.4.0, versionCode 4
2. `mobile/app/src/config.ts` - APP_VERSION = '1.4.0'
3. `mobile/app/src/journeyRecorder.ts` - Native service integration
4. `mobile/app/App.tsx` - Recovery flow on launch
5. `mobile/app/src/components/JourneyDashboard.tsx` - Screen lock instructions
6. `mobile/app/src/collection/queue.ts` - Verified queue-before-clear
7. `mobile/app/.gitignore` - Native build exclusions
8. `PRODUCT.md` - Updated product docs
9. `docs/CONTROLLED_COLLECTION_PROTOCOL.md` - Android references

### Created (6 files/directories)
1. `mobile/app/modules/road-recorder/` - Native module
2. `mobile/app/modules/road-recorder/android/src/main/java/org/betterroads/recorder/RecordingService.kt`
3. `mobile/app/modules/road-recorder/android/src/main/java/org/betterroads/recorder/RoadRecorderModule.kt`
4. `mobile/app/modules/road-recorder/android/src/main/AndroidManifest.xml`
5. `mobile/app/src/collection/journalReplay.ts` - Bounded replay
6. `mobile/app/src/collection/nativeRecording.ts` - Bridge interface
7. `docs/ANDROID_BACKGROUND_RECORDING.md` - Implementation docs

---

## Final Verification Result

### ✅ ALL CLAIMS VERIFIED

The implementation is **complete and correct** in the working tree:

1. ✅ Android native foreground service with GPS, accelerometer, gyroscope, wake lock, and persistent notification
2. ✅ Samples journaled safely with crash recovery and replay capability
3. ✅ Upload queue written before journal cleared (offline safety)
4. ✅ Permissions, UI instructions, Android manifest, version 1.4.0, and documentation all updated
5. ✅ iOS remains foreground-only (Android-specific implementation)

### Next Steps Required

**Before Release:**
1. **Physical device testing** (15+ min screen-locked recording)
2. Test all failure scenarios from documentation checklist
3. Build signed APK/AAB with version 1.4.0
4. Verify notification appears and recording continues with screen off
5. Test recovery after force-stop, reboot, permission revocation
6. Verify offline upload queue retention and flush on reconnect

**Not Yet Done (Outside Scope):**
- Physical Android device testing
- APK/AAB build and signing
- GitHub Release publication
- Real-world battery/performance validation

---

**Conclusion:** The code implementation is production-ready pending physical device validation. All architectural requirements have been met, safety mechanisms are in place, and the implementation follows Android best practices for foreground services.
