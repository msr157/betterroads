package com.example.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Binder
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.example.MainActivity
import com.example.data.local.AppDatabase
import com.example.data.local.JourneyEntity
import com.example.data.local.JourneySegmentEntity
import com.example.data.local.RoadEventEntity
import com.example.data.model.PhoneMountPosition
import com.example.data.model.RoadEventType
import com.example.data.model.VehicleType
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID
import kotlin.math.absoluteValue
import kotlin.math.sqrt

class SensingService : Service(), SensorEventListener, LocationListener {

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    // Managers
    private lateinit var sensorManager: SensorManager
    private lateinit var locationManager: LocationManager
    private lateinit var db: AppDatabase

    // Sensors
    private var accelSensor: Sensor? = null
    private var linearAccelSensor: Sensor? = null
    private var gyroSensor: Sensor? = null
    private var pressureSensor: Sensor? = null
    private var magSensor: Sensor? = null

    // Session Configuration & Data
    private var currentJourneyId: String = ""
    private var vehicleType: VehicleType = VehicleType.CAR
    private var mountPosition: PhoneMountPosition = PhoneMountPosition.DASHBOARD_MOUNT
    private var isSimulating: Boolean = false

    // Real-Time Sensor Processing Variables
    private var gravity = floatArrayOf(0f, 0f, 9.81f)
    private val alpha = 0.8f // Gravity filter smoothing factor
    private val recentSamples = ArrayList<Float>() // Sliding window for RMS
    private val windowSize = 50 // 500ms sliding window at 100Hz
    private var lastEventTimestamp: Long = 0
    private var lastBridgeJointTimestamp: Long = 0

    // Journey Metrics
    private var startLat = 19.0596 // Default Mumbai coordinates (Bandra)
    private var startLon = 72.8295
    private var lastLat = 19.0596
    private var lastLon = 72.8295
    private var totalDistanceM = 0.0
    private var startTimeMs = 0L
    private var elapsedSeconds = 0L
    private var speedKmh = 0.0
    private var peakZForce = 0f
    private var currentLiveRms = 0f
    private var eventCount = 0
    private var segmentIndex = 0

    // Simulation Job
    private var simulationJob: Job? = null

    inner class LocalBinder : Binder() {
        fun getService(): SensingService = this@SensingService
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        db = AppDatabase.getDatabase(this)

        // Initialize actual sensors
        accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        linearAccelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
        gyroSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
        pressureSensor = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)
        magSensor = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val journeyId = intent?.getStringExtra("JOURNEY_ID") ?: UUID.randomUUID().toString()
        val vTypeStr = intent?.getStringExtra("VEHICLE_TYPE") ?: VehicleType.CAR.name
        val mPosStr = intent?.getStringExtra("MOUNT_POSITION") ?: PhoneMountPosition.DASHBOARD_MOUNT.name
        val simEnabled = intent?.getBooleanExtra("SIMULATING", false) ?: false

        if (action == ACTION_START) {
            startSensing(journeyId, VehicleType.valueOf(vTypeStr), PhoneMountPosition.valueOf(mPosStr), simEnabled)
        } else if (action == ACTION_STOP) {
            stopSensing()
        }

        return START_NOT_STICKY
    }

    private fun startSensing(
        id: String,
        vType: VehicleType,
        mPos: PhoneMountPosition,
        simulate: Boolean
    ) {
        currentJourneyId = id
        vehicleType = vType
        mountPosition = mPos
        isSimulating = simulate

        startTimeMs = System.currentTimeMillis()
        totalDistanceM = 0.0
        elapsedSeconds = 0
        speedKmh = 0.0
        eventCount = 0
        segmentIndex = 0
        peakZForce = 0f
        currentLiveRms = 0f
        recentSamples.clear()

        _isTracking.value = true
        _liveTelemetry.value = LiveTelemetry(
            journeyId = currentJourneyId,
            isActive = true,
            isSimulating = isSimulating,
            vehicleType = vehicleType,
            mountPosition = mountPosition,
            speedKmh = 0.0,
            distanceM = 0.0,
            elapsedSeconds = 0,
            liveRms = 0f,
            isUnmounted = false,
            eventsCount = 0,
            latestEvent = null
        )

        // Request System Foreground Service
        startForeground(NOTIFICATION_ID, createNotification("Better Roads: Tracking trip on ${vehicleType.displayName}"))

        if (isSimulating) {
            startSimulationLoop()
        } else {
            registerHardwareListeners()
        }

        // Timer for elapsed seconds and distance calculations
        serviceScope.launch {
            while (isActive) {
                delay(1000)
                elapsedSeconds++
                // Save/update temporary progress in Database every 10 seconds
                if (elapsedSeconds % 10L == 0L) {
                    saveJourneyProgress()
                }
                updateTelemetry()
            }
        }
    }

    private fun registerHardwareListeners() {
        accelSensor?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        linearAccelSensor?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        gyroSensor?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        pressureSensor?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
        magSensor?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }

        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                1000L,
                1f,
                this
            )
            // Grab last known location to seed start coordinates
            locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let {
                onLocationChanged(it)
            }
        } catch (e: SecurityException) {
            // Log security exception
        }
    }

    private fun startSimulationLoop() {
        simulationJob = serviceScope.launch {
            // Simulated Mumbai Route points (approx 1.5km long)
            val routePoints = listOf(
                Pair(19.0596, 72.8295), // Bandra Carter Rd
                Pair(19.0551, 72.8276),
                Pair(19.0505, 72.8288),
                Pair(19.0450, 72.8335),
                Pair(19.0401, 72.8389), // Towards Mahim
                Pair(19.0321, 72.8402),
                Pair(19.0255, 72.8420)
            )

            var routeIndex = 0
            var routeStep = 0.0

            startLat = routePoints[0].first
            startLon = routePoints[0].second
            lastLat = startLat
            lastLon = startLon

            while (isActive) {
                delay(100) // 10 Hz telemetry simulation loop

                // Calculate current speed (simulating 15 to 45 km/h)
                speedKmh = 25.0 + (5.0 * kotlin.math.sin(elapsedSeconds / 10.0)) + (2.0 * Math.random() - 1.0)
                if (speedKmh < 0.0) speedKmh = 0.0

                // Simulate GPS position movement
                val currentStart = routePoints[routeIndex]
                val currentEnd = routePoints[(routeIndex + 1) % routePoints.size]

                routeStep += (speedKmh / 3.6) * 0.1 / 150.0 // Normalise step
                if (routeStep >= 1.0) {
                    routeStep = 0.0
                    routeIndex = (routeIndex + 1) % routePoints.size
                }

                val currentLat = currentStart.first + (currentEnd.first - currentStart.first) * routeStep
                val currentLon = currentStart.second + (currentEnd.second - currentStart.second) * routeStep

                val distanceStep = (speedKmh / 3.6) * 0.1
                totalDistanceM += distanceStep

                lastLat = currentLat
                lastLon = currentLon

                // --- Generate Raw Accelerometer Readings ---
                // Baseline vibration depends on vehicle floor
                val baseNoise = vehicleType.baselineRms
                val randomEngineBuzz = (Math.random().toFloat() - 0.5f) * baseNoise * 0.4f

                // Randomly trigger pothole shock every 15-25 seconds
                var dynamicZ = randomEngineBuzz
                var isShock = false
                var shockMag = 0f

                if (elapsedSeconds > 5 && elapsedSeconds % 17L == 0L && Math.random() > 0.3) {
                    // Pothole candidate shock spike!
                    shockMag = 18f + (Math.random().toFloat() * 12f) // 1.8g to 3.0g
                    dynamicZ += shockMag
                    isShock = true
                } else if (elapsedSeconds > 5 && elapsedSeconds % 25L == 0L) {
                    // Speed breaker (hump)
                    shockMag = 8f + (Math.random().toFloat() * 6f) // 0.8g to 1.4g
                    dynamicZ += shockMag
                    isShock = true
                } else if (elapsedSeconds > 3 && (elapsedSeconds % 8L == 0L || elapsedSeconds % 9L == 0L) && Math.random() > 0.5) {
                    // Rough patch vibration spikes
                    dynamicZ += (Math.random().toFloat() * 5f)
                }

                // Process RMS
                processZForceSample(dynamicZ)

                // Detect candidate shock event
                if (isShock && speedKmh > 8.0) {
                    val eventType = if (shockMag > 15f) RoadEventType.POTHOLE else RoadEventType.SPEED_BREAKER
                    triggerRoadEvent(
                        type = eventType,
                        severity = (shockMag.toDouble() / 30.0).coerceIn(0.1, 1.0),
                        lat = currentLat,
                        lon = currentLon,
                        speed = speedKmh,
                        ax = 0.5,
                        ay = 0.5,
                        az = dynamicZ.toDouble(),
                        gZ = 0.2
                    )
                }

                // Check segment aggregate boundary (approx every 300 meters)
                if (totalDistanceM > 0 && (totalDistanceM.toInt() / 300) > segmentIndex) {
                    createAndSaveSegment(segmentIndex, currentLat, currentLon)
                    segmentIndex++
                }

                updateTelemetry()
            }
        }
    }

    private fun processZForceSample(zSample: Float) {
        // Subtract baseline vehicle floor first
        val cleanSample = zSample - vehicleType.baselineRms
        recentSamples.add(cleanSample)
        if (recentSamples.size > windowSize) {
            recentSamples.removeAt(0)
        }

        // Compute sliding window RMS
        if (recentSamples.isNotEmpty()) {
            var sumSquare = 0f
            for (s in recentSamples) {
                sumSquare += s * s
            }
            currentLiveRms = sqrt(sumSquare / recentSamples.size)
        }
    }

    private fun triggerRoadEvent(
        type: RoadEventType,
        severity: Double,
        lat: Double,
        lon: Double,
        speed: Double,
        ax: Double,
        ay: Double,
        az: Double,
        gZ: Double
    ) {
        val now = System.currentTimeMillis()
        if (now - lastEventTimestamp < 1000L) return // Event cooldown (minimum 1 second gap)
        lastEventTimestamp = now

        val eventId = UUID.randomUUID().toString()
        val eventEntity = RoadEventEntity(
            id = eventId,
            journeyId = currentJourneyId,
            type = type.name,
            severity = severity,
            timestamp = now,
            lat = lat,
            lon = lon,
            altitudeM = 15.0,
            speedKmh = speed,
            accelX = ax,
            accelY = ay,
            accelZ = az,
            gyroZ = gZ,
            heading = 180.0
        )

        eventCount++

        serviceScope.launch(Dispatchers.IO) {
            db.roadDao().insertEvent(eventEntity)
        }

        val lastEvent = LiveEvent(
            type = type,
            severity = severity,
            lat = lat,
            lon = lon,
            timestamp = now
        )

        _liveTelemetry.value = _liveTelemetry.value.copy(
            eventsCount = eventCount,
            latestEvent = lastEvent
        )
    }

    private fun createAndSaveSegment(index: Int, lat: Double, lon: Double) {
        val segId = UUID.randomUUID().toString()
        val rqi = calculateRqiForSegment()

        val segment = JourneySegmentEntity(
            id = segId,
            journeyId = currentJourneyId,
            segmentIndex = index,
            startLat = lastLat,
            startLon = lastLon,
            endLat = lat,
            endLon = lon,
            lengthM = 300.0,
            rqiScore = rqi,
            eventCount = eventCount,
            avgRms = currentLiveRms.toDouble()
        )

        serviceScope.launch(Dispatchers.IO) {
            db.roadDao().insertSegments(listOf(segment))
        }
    }

    private fun calculateRqiForSegment(): Double {
        // RQI formula from spec: RQI = 100 - weighted events & roughness
        // Normalise RMS: 1.0g RMS (approx 10 m/s2) is terrible.
        val roughnessPenalty = (currentLiveRms * 10f).coerceIn(0f, 40f)
        val eventPenalty = (eventCount * 12f).coerceIn(0f, 50f)
        val finalScore = (100f - roughnessPenalty - eventPenalty).coerceIn(10f, 100f)
        return finalScore.toDouble()
    }

    private fun saveJourneyProgress() {
        val now = System.currentTimeMillis()
        val journey = JourneyEntity(
            id = currentJourneyId,
            startedAt = startTimeMs,
            endedAt = null,
            distanceM = totalDistanceM,
            durationS = elapsedSeconds,
            avgSpeedKmh = speedKmh,
            rqiScore = calculateRqiForSegment(),
            eventCount = eventCount,
            startLat = startLat,
            startLon = startLon,
            endLat = lastLat,
            endLon = lastLon,
            synced = 0,
            vehicleType = vehicleType.name,
            phoneMountPosition = mountPosition.name,
            baseFloorRms = vehicleType.baselineRms
        )

        serviceScope.launch(Dispatchers.IO) {
            db.roadDao().insertJourney(journey)
        }
    }

    private fun stopSensing() {
        if (!_isTracking.value) return

        simulationJob?.cancel()
        sensorManager.unregisterListener(this)
        locationManager.removeUpdates(this)

        serviceScope.launch {
            // Finalize Journey Entity
            val now = System.currentTimeMillis()
            val finalJourney = JourneyEntity(
                id = currentJourneyId,
                startedAt = startTimeMs,
                endedAt = now,
                distanceM = totalDistanceM,
                durationS = elapsedSeconds,
                avgSpeedKmh = if (elapsedSeconds > 0) (totalDistanceM / elapsedSeconds) * 3.6 else 0.0,
                rqiScore = calculateRqiForSegment(),
                eventCount = eventCount,
                startLat = startLat,
                startLon = startLon,
                endLat = lastLat,
                endLon = lastLon,
                synced = 0,
                vehicleType = vehicleType.name,
                phoneMountPosition = mountPosition.name,
                baseFloorRms = vehicleType.baselineRms
            )

            withContext(Dispatchers.IO) {
                db.roadDao().insertJourney(finalJourney)
            }

            _isTracking.value = false
            _liveTelemetry.value = _liveTelemetry.value.copy(
                isActive = false,
                speedKmh = 0.0
            )

            stopForeground(true)
            stopSelf()
        }
    }

    private fun updateTelemetry() {
        _liveTelemetry.value = _liveTelemetry.value.copy(
            speedKmh = speedKmh,
            distanceM = totalDistanceM,
            elapsedSeconds = elapsedSeconds,
            liveRms = currentLiveRms
        )
    }

    // --- Location Callback ---
    override fun onLocationChanged(location: Location) {
        if (isSimulating) return

        val lat = location.latitude
        val lon = location.longitude
        speedKmh = location.speed * 3.6

        if (totalDistanceM == 0.0) {
            startLat = lat
            startLon = lon
            lastLat = lat
            lastLon = lon
        } else {
            val distStep = FloatArray(1)
            Location.distanceBetween(lastLat, lastLon, lat, lon, distStep)
            totalDistanceM += distStep[0]
            lastLat = lat
            lastLon = lon
        }

        // Segment threshold check
        if (totalDistanceM > 0 && (totalDistanceM.toInt() / 300) > segmentIndex) {
            createAndSaveSegment(segmentIndex, lat, lon)
            segmentIndex++
        }

        updateTelemetry()
    }

    // --- Sensor Callbacks ---
    override fun onSensorChanged(event: SensorEvent?) {
        if (isSimulating || event == null) return

        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                // Low pass gravity estimation
                gravity[0] = alpha * gravity[0] + (1 - alpha) * event.values[0]
                gravity[1] = alpha * gravity[1] + (1 - alpha) * event.values[1]
                gravity[2] = alpha * gravity[2] + (1 - alpha) * event.values[2]

                // Verticality ratio filter check to separate user handling noise
                val verticalZ = event.values[2].absoluteValue
                val horizontalX = event.values[0].absoluteValue
                val horizontalY = event.values[1].absoluteValue
                val verticalityRatio = verticalZ / (horizontalX + horizontalY + 0.001f)

                // If orientation drift triggers, notify UI
                val gravityMag = sqrt(gravity[0]*gravity[0] + gravity[1]*gravity[1] + gravity[2]*gravity[2])
                val isUnmounted = gravityMag < 8.0f || gravityMag > 12.0f || verticalityRatio < 0.4f
                if (isUnmounted != _liveTelemetry.value.isUnmounted) {
                    _liveTelemetry.value = _liveTelemetry.value.copy(isUnmounted = isUnmounted)
                }
            }
            Sensor.TYPE_LINEAR_ACCELERATION -> {
                val zForce = event.values[2] // Dynamic dynamic vertical force
                processZForceSample(zForce)

                // Peak Z-Score detection for discrete road damage shocks
                val dynamicPeakZ = zForce.absoluteValue
                if (dynamicPeakZ > peakZForce) {
                    peakZForce = dynamicPeakZ
                }

                // Threshold-based detection: 1.5g (approx 14.7 m/s2) is a bump, 2.5g is pothole
                val speed = speedKmh
                val isStableMount = !_liveTelemetry.value.isUnmounted
                if (dynamicPeakZ > 12.0f && speed > 8.0 && isStableMount) {
                    val roadType = if (dynamicPeakZ > 22.0f) RoadEventType.POTHOLE else RoadEventType.BUMP
                    triggerRoadEvent(
                        type = roadType,
                        severity = (dynamicPeakZ.toDouble() / 30.0).coerceIn(0.1, 1.0),
                        lat = lastLat,
                        lon = lastLon,
                        speed = speed,
                        ax = event.values[0].toDouble(),
                        ay = event.values[1].toDouble(),
                        az = event.values[2].toDouble(),
                        gZ = 0.0
                    )
                }
            }
            Sensor.TYPE_GYROSCOPE -> {
                val rotX = event.values[0].absoluteValue
                val rotY = event.values[1].absoluteValue
                val rotZ = event.values[2].absoluteValue

                // Evasive swerve check: yaw velocity spikes with lateral acceleration
                if (rotZ > 0.6f && speedKmh > 15.0) {
                    triggerRoadEvent(
                        type = RoadEventType.SWERVE,
                        severity = (rotZ / 2.0).coerceIn(0.1, 1.0),
                        lat = lastLat,
                        lon = lastLon,
                        speed = speedKmh,
                        ax = 0.0,
                        ay = 0.0,
                        az = 0.0,
                        gZ = rotZ.toDouble()
                    )
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    // --- Foreground Notification ---
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Better Roads Sensor Logging",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Better Roads active")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentIntent(pendingIntent)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "better_roads_sensing_channel"
        const val NOTIFICATION_ID = 557

        const val ACTION_START = "com.example.action.START_SENSING"
        const val ACTION_STOP = "com.example.action.STOP_SENSING"

        private val _isTracking = MutableStateFlow(false)
        val isTracking: StateFlow<Boolean> = _isTracking.asStateFlow()

        private val _liveTelemetry = MutableStateFlow(
            LiveTelemetry(
                journeyId = "",
                isActive = false,
                isSimulating = false,
                vehicleType = VehicleType.CAR,
                mountPosition = PhoneMountPosition.DASHBOARD_MOUNT,
                speedKmh = 0.0,
                distanceM = 0.0,
                elapsedSeconds = 0,
                liveRms = 0f,
                isUnmounted = false,
                eventsCount = 0,
                latestEvent = null
            )
        )
        val liveTelemetry: StateFlow<LiveTelemetry> = _liveTelemetry.asStateFlow()
    }
}

data class LiveTelemetry(
    val journeyId: String,
    val isActive: Boolean,
    val isSimulating: Boolean,
    val vehicleType: VehicleType,
    val mountPosition: PhoneMountPosition,
    val speedKmh: Double,
    val distanceM: Double,
    val elapsedSeconds: Long,
    val liveRms: Float,
    val isUnmounted: Boolean,
    val eventsCount: Int,
    val latestEvent: LiveEvent?
)

data class LiveEvent(
    val type: RoadEventType,
    val severity: Double,
    val lat: Double,
    val lon: Double,
    val timestamp: Long
)
