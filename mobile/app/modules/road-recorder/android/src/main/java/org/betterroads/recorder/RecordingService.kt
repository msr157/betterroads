package org.betterroads.recorder

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.*
import android.location.*
import android.os.*
import org.json.JSONArray
import java.io.FileOutputStream

/** Owns hardware and storage independently of React/Activity lifecycle. */
class RecordingService : Service(), SensorEventListener, LocationListener {
  companion object {
    @Volatile var active: RecordingService? = null
    @Volatile var lastSampleAt = 0L
    @Volatile var lastLocationAt = 0L
    private const val NOTIFICATION_ID = 731
    internal const val ERROR_NOTIFICATION_ID = NOTIFICATION_ID + 1
    private const val CHANNEL = "road-recording"
    private const val MAX_BYTES = 256L * 1024 * 1024
    private const val MAX_DURATION_MS = 12L * 60 * 60 * 1000
  }
  private lateinit var sensors: SensorManager
  private lateinit var locations: LocationManager
  private val thread = HandlerThread("RoadRecording")
  private lateinit var worker: Handler
  private var output: FileOutputStream? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var startedElapsed = 0L
  private var epochOffset = 0.0
  private var bytes = 0L
  private var lastAccel = 0L
  private var lastGyro = 0L

  override fun onBind(intent: Intent?) = null
  override fun onCreate() {
    super.onCreate()
    sensors = getSystemService(SENSOR_SERVICE) as SensorManager
    locations = getSystemService(LOCATION_SERVICE) as LocationManager
    thread.start(); worker = Handler(thread.looper)
    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
      NotificationChannel(CHANNEL, "Journey recording", NotificationManager.IMPORTANCE_LOW)
    )
  }

  private fun notification(text: String): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)!!
    val open = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val stop = PendingIntent.getService(this, 1, Intent(this, RecordingService::class.java).setAction("STOP"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("BetterRoads journey").setContentText(text).setContentIntent(open)
      .setOngoing(true).setOnlyAlertOnce(true).addAction(Notification.Action.Builder(null, "Stop recording", stop).build()).build()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    synchronized(Journal.lock) {
      if (intent?.action == "STOP") { finish(null); return START_NOT_STICKY }
      if (active != null) return START_NOT_STICKY
      try {
        val note = notification("Starting GPS and motion sensors…")
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        else startForeground(NOTIFICATION_ID, note)
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
        active = this
        check(sensors.registerListener(this, accel, 20_000, 0, worker)) { "Cannot start accelerometer." }
        check(sensors.registerListener(this, gyro, 20_000, 0, worker)) { "Cannot start gyroscope." }
        locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, thread.looper)
        worker.postDelayed(health, 1000)
      } catch (e: Exception) { finish(e.message ?: "Recording could not start.") }
    }
    // Never silently restart a journey after force-stop/reboot or create a hidden new journey.
    return START_NOT_STICKY
  }

  private fun append(row: JSONArray) {
    val encoded = (row.toString() + "\n").toByteArray(Charsets.UTF_8)
    check(bytes + encoded.size <= MAX_BYTES) { "Journey storage limit reached. Saved data is ready to finish." }
    output!!.write(encoded); bytes += encoded.size
  }

  fun appendMarker(markerType: String) {
    check(markerType == "PASSENGER_ROAD_FEATURE" || markerType == "KNOWN_NORMAL_SECTION" || markerType == "HANDLING_ARTIFACT") {
      "Unknown marker type."
    }
    append(JSONArray().put("m").put(System.currentTimeMillis()).put(java.util.UUID.randomUUID().toString()).put(markerType))
  }
  override fun onSensorChanged(event: SensorEvent) = synchronized(Journal.lock) {
    if (active !== this) return@synchronized
    try {
      val kind = if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) "a" else "g"
      val epoch = epochOffset + event.timestamp / 1_000_000.0
      append(JSONArray().put(kind).put(epoch).put(event.timestamp / 1_000_000_000.0)
        .put(event.values[0].toDouble()).put(event.values[1].toDouble()).put(event.values[2].toDouble()))
      lastSampleAt = System.currentTimeMillis()
      if (kind == "a") lastAccel = SystemClock.elapsedRealtime() else lastGyro = SystemClock.elapsedRealtime()
    } catch (e: Exception) { finish(e.message ?: "Sensor storage failed.") }
  }
  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
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
    } catch (e: Exception) { finish(e.message ?: "Location storage failed.") }
  }
  override fun onProviderDisabled(provider: String) { if (provider == LocationManager.GPS_PROVIDER) synchronized(Journal.lock) { finish("GPS was turned off. Finish the saved journey.") } }
  override fun onProviderEnabled(provider: String) {}
  @Deprecated("Legacy callback")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

  private val health = object : Runnable {
    override fun run() = synchronized(Journal.lock) {
      if (active !== this@RecordingService) return@synchronized
      try {
        output?.fd?.sync() // At most one second of unsynced data on sudden power loss.
        val elapsed = SystemClock.elapsedRealtime()
        check(elapsed - startedElapsed < MAX_DURATION_MS) { "12-hour recording limit reached. Finish this journey." }
        check(elapsed - maxOf(lastAccel, startedElapsed) < 15_000 && elapsed - maxOf(lastGyro, startedElapsed) < 15_000) { "Motion sensors stopped delivering data. Finish the saved journey." }
        val text = if (System.currentTimeMillis() - lastLocationAt > 15_000) "Waiting for GPS · motion data is being saved" else "Recording GPS and motion · screen can be locked"
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification(text))
        worker.postDelayed(this, 1000)
      } catch (e: Exception) { finish(e.message ?: "Recording interrupted.") }
    }
  }

  fun finish(error: String?) {
    sensors.unregisterListener(this)
    locations.removeUpdates(this)
    worker.removeCallbacksAndMessages(null)
    try { output?.fd?.sync() } catch (_: Exception) {}
    try { output?.close() } catch (_: Exception) {}
    output = null
    wakeLock?.let { if (it.isHeld) it.release() }; wakeLock = null
    if (active === this) active = null
    try {
      Journal.read(this)?.let {
        if (!it.has("endedAt")) it.put("endedAt", System.currentTimeMillis())
        if (error != null) it.put("error", error)
        Journal.save(this, it)
      }
    } finally {
      stopForeground(STOP_FOREGROUND_REMOVE)
      if (error != null) (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(ERROR_NOTIFICATION_ID,
        notification(error).also { it.flags = it.flags and Notification.FLAG_ONGOING_EVENT.inv() })
      stopSelf()
    }
  }
  override fun onDestroy() {
    synchronized(Journal.lock) { if (active === this) finish("Recording was interrupted. Saved samples can be recovered.") }
    thread.quitSafely()
    super.onDestroy()
  }
}
