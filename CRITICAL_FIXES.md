# Critical Fixes Required Before Merge

**Date:** October 2, 2026  
**Review:** Android Background Recording PR #10

---

## 🔴 Must Fix Immediately (2 Issues)

### Issue #1: Race Condition in Service Start

**File:** `mobile/app/modules/road-recorder/android/src/main/java/org/betterroads/recorder/RecordingService.kt`  
**Lines:** 56-86  
**Severity:** 🟡 MAJOR

**Problem:**  
The `active` flag is set AFTER service initialization begins, creating a window where two service instances could start simultaneously.

**Current Code:**
```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
  synchronized(Journal.lock) {
    if (intent?.action == "STOP") { finish(null); return START_NOT_STICKY }
    if (active != null) return START_NOT_STICKY  // Check active
    try {
      val note = notification("Starting GPS and motion sensors…")
      startForeground(NOTIFICATION_ID, note)
      // ... initialization ...
      active = this  // Set active AFTER init starts ⚠️
```

**Fixed Code:**
```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
  synchronized(Journal.lock) {
    if (intent?.action == "STOP") { finish(null); return START_NOT_STICKY }
    if (active != null) return START_NOT_STICKY
    
    // Set active IMMEDIATELY to prevent second instance
    active = this
    
    try {
      val note = notification("Starting GPS and motion sensors…")
      startForeground(NOTIFICATION_ID, note)
      check(Journal.read(this) != null) { "Missing journey metadata." }
      check(locations.isProviderEnabled(LocationManager.GPS_PROVIDER)) { "Turn on precise location before recording." }
      val accel = requireNotNull(sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)) { "Accelerometer unavailable." }
      val gyro = requireNotNull(sensors.getDefaultSensor(Sensor.TYPE_GYROSCOPE)) { "Gyroscope unavailable." }
      output = FileOutputStream(Journal.samples(this), true)
      bytes = Journal.samples(this).length()
      epochOffset = System.currentTimeMillis() - SystemClock.elapsedRealtimeNanos() / 1_000_000.0
      startedElapsed = SystemClock.elapsedRealtime()
      lastSampleAt = 0; lastLocationAt = 0; lastAccel = 0; lastGyro = 0
      wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BetterRoads:Journey").apply {
          setReferenceCounted(false); acquire(MAX_DURATION_MS + 60_000)
        }
      check(sensors.registerListener(this, accel, 20_000, 0, worker)) { "Cannot start accelerometer." }
      check(sensors.registerListener(this, gyro, 20_000, 0, worker)) { "Cannot start gyroscope." }
      locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, thread.looper)
      worker.postDelayed(health, 1000)
    } catch (e: Exception) {
      // Clear active on failure
      active = null
      finish(e.message ?: "Recording could not start.")
    }
  }
  return START_NOT_STICKY
}
```

**Impact:** Could cause double recording, corrupted journal, battery drain

---

### Issue #2: Memory Leak in Handler Callbacks

**File:** `mobile/app/modules/road-recorder/android/src/main/java/org/betterroads/recorder/RecordingService.kt`  
**Lines:** 129-142  
**Severity:** 🟡 MAJOR

**Problem:**  
The health check runnable continues posting callbacks even after `active` is cleared, if an exception bypasses normal cleanup.

**Current Code:**
```kotlin
private val health = object : Runnable {
  override fun run() = synchronized(Journal.lock) {
    if (active !== this@RecordingService) return@synchronized
    try {
      output?.fd?.sync()
      // ... health checks ...
      worker.postDelayed(this, 1000)  // ⚠️ Continues posting
    } catch (e: Exception) { 
      finish(e.message ?: "Recording interrupted.") 
    }
  }
}
```

**Fixed Code:**
```kotlin
private val health = object : Runnable {
  override fun run() = synchronized(Journal.lock) {
    if (active !== this@RecordingService) {
      // Defensive cleanup if active was cleared elsewhere
      worker.removeCallbacksAndMessages(null)
      return@synchronized
    }
    try {
      output?.fd?.sync() // At most one second of unsynced data on sudden power loss.
      val elapsed = SystemClock.elapsedRealtime()
      check(elapsed - startedElapsed < MAX_DURATION_MS) { "12-hour recording limit reached. Finish this journey." }
      check(elapsed - maxOf(lastAccel, startedElapsed) < 15_000 && elapsed - maxOf(lastGyro, startedElapsed) < 15_000) { 
        "Motion sensors stopped delivering data. Finish the saved journey." 
      }
      val text = if (System.currentTimeMillis() - lastLocationAt > 15_000) 
        "Waiting for GPS · motion data is being saved" 
      else 
        "Recording GPS and motion · screen can be locked"
      (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification(text))
      worker.postDelayed(this, 1000)
    } catch (e: Exception) {
      android.util.Log.e("RecordingService", "Health check failed", e)
      finish(e.message ?: "Recording interrupted.")
    }
  }
}
```

**Also add logging to sensor callbacks:**
```kotlin
override fun onSensorChanged(event: SensorEvent) = synchronized(Journal.lock) {
  if (active !== this) return@synchronized
  try {
    val kind = if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) "a" else "g"
    val epoch = epochOffset + event.timestamp / 1_000_000.0
    append(JSONArray().put(kind).put(epoch).put(event.timestamp / 1_000_000_000.0)
      .put(event.values[0].toDouble()).put(event.values[1].toDouble()).put(event.values[2].toDouble()))
    lastSampleAt = System.currentTimeMillis()
    if (kind == "a") lastAccel = SystemClock.elapsedRealtime() else lastGyro = SystemClock.elapsedRealtime()
  } catch (e: Exception) {
    android.util.Log.e("RecordingService", "Sensor error", e)
    finish(e.message ?: "Sensor storage failed.")
    return@synchronized  // Ensure we exit after calling finish
  }
}

override fun onLocationChanged(location: Location) = synchronized(Journal.lock) {
  if (active !== this) return@synchronized
  try {
    val elapsedNanos = location.elapsedRealtimeNanos.takeIf { it > 0L } ?: SystemClock.elapsedRealtimeNanos()
    append(JSONArray().put("l").put(epochOffset + elapsedNanos / 1_000_000.0)
      .put(location.latitude).put(location.longitude).put(location.accuracy.toDouble())
      .put(if (location.hasSpeed()) location.speed.toDouble() else 0.0)
      .put(if (location.hasBearing()) location.bearing.toDouble() else null)
      .put(if (location.hasAltitude()) location.altitude else null))
    lastLocationAt = System.currentTimeMillis()
  } catch (e: Exception) {
    android.util.Log.e("RecordingService", "Location error", e)
    finish(e.message ?: "Location storage failed.")
    return@synchronized
  }
}
```

**Impact:** Handler queue grows unbounded, memory leak, battery drain

---

## 🟢 Recommended Fixes (Non-Blocking)

### Issue #3: Add Explicit Charset to File Operations

**File:** `mobile/app/modules/road-recorder/android/src/main/java/org/betterroads/recorder/RoadRecorderModule.kt`  
**Line:** 20

**Change:**
```kotlin
fun read(context: Context): JSONObject? = 
  metadata(context).takeIf { it.exists() }?.let { 
    JSONObject(it.readText(Charsets.UTF_8))  // Add explicit charset
  }
```

---

### Issue #4: Better Error Messages in Journal Read

**File:** `mobile/app/modules/road-recorder/android/src/main/java/org/betterroads/recorder/RoadRecorderModule.kt`  
**Lines:** 63-80

**Change:**
```kotlin
AsyncFunction("read") { offset: Double ->
  synchronized(Journal.lock) {
    try {
      val rows = org.json.JSONArray()
      RandomAccessFile(Journal.samples(context), "r").use { file ->
        if (offset < 0 || offset > file.length()) {
          throw IllegalArgumentException(
            "Invalid journal offset: $offset (file size: ${file.length()})"
          )
        }
        file.seek(offset.toLong())
        var count = 0
        while (count < 1000 && file.filePointer < file.length()) {
          val before = file.filePointer
          val line = file.readLine() ?: break
          try { 
            rows.put(org.json.JSONArray(line)) 
          } catch (e: Exception) { 
            android.util.Log.w("RoadRecorderModule", "Skipping corrupt line at $before: ${e.message}")
            file.seek(before)
            break 
          }
          count++
        }
        JSONObject().put("rows", rows).put("offset", file.filePointer).toString()
      }
    } catch (e: Exception) {
      android.util.Log.e("RoadRecorderModule", "Failed to read journal", e)
      throw IllegalStateException("Failed to read journal at offset $offset: ${e.message}", e)
    }
  }
}
```

---

### Issue #5: Add Exponential Backoff in Start Polling

**File:** `mobile/app/src/journeyRecorder.ts`  
**Lines:** 160-171

**Change:**
```typescript
for (let attempt = 0; attempt < 30; attempt++) {
  const session = await nativeSession();
  if (session?.running) { this.native = session; return; }
  if (session?.error) {
    await nativeRecorder().clear(session.id);
    this.native = null;
    throw new Error(session.error);
  }
  // Exponential backoff: 100ms, 130ms, 169ms, ... up to 500ms max
  const delay = Math.min(100 * Math.pow(1.3, attempt), 500);
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
}
await nativeRecorder().stop();
throw new Error('Recording did not start. Reopen the app to recover the saved session.');
```

---

## Summary

**Status:** ✅ Code is **95% production-ready**

**Must fix before merge:** 2 issues (#1, #2)  
**Recommended fixes:** 3 issues (#3, #4, #5)  
**Total time to fix:** ~30 minutes

**After fixes:**
1. Re-test on physical device
2. Verify race condition is resolved (rapid start/stop test)
3. Verify handler cleanup (run for 1 hour then check memory)
4. Merge PR #10

---

**Next Steps:**
1. Apply fixes to `RecordingService.kt`
2. Apply fixes to `RoadRecorderModule.kt`
3. Apply fix to `journeyRecorder.ts`
4. Test locally
5. Commit fixes
6. Push to branch
7. Merge PR

The core implementation is excellent. These are defensive improvements to handle edge cases.
