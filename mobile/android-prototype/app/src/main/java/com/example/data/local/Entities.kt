package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "journeys")
data class JourneyEntity(
    @PrimaryKey val id: String,
    val startedAt: Long,
    val endedAt: Long?,
    val distanceM: Double,
    val durationS: Long,
    val avgSpeedKmh: Double,
    val rqiScore: Double,
    val eventCount: Int,
    val startLat: Double,
    val startLon: Double,
    val endLat: Double,
    val endLon: Double,
    val synced: Int = 0, // 0 = pending, 1 = synced
    val createdAt: Long = System.currentTimeMillis(),
    val vehicleType: String,
    val phoneMountPosition: String,
    val baseFloorRms: Float = 0.35f
)

@Entity(tableName = "road_events")
data class RoadEventEntity(
    @PrimaryKey val id: String,
    val journeyId: String,
    val type: String, // 'POTHOLE', 'BUMP', 'SPEED_BREAKER', etc.
    val severity: Double, // 0.0 - 1.0
    val timestamp: Long,
    val lat: Double,
    val lon: Double,
    val altitudeM: Double,
    val speedKmh: Double,
    val accelX: Double,
    val accelY: Double,
    val accelZ: Double,
    val gyroZ: Double,
    val heading: Double,
    val synced: Int = 0
)

@Entity(tableName = "journey_segments")
data class JourneySegmentEntity(
    @PrimaryKey val id: String,
    val journeyId: String,
    val segmentIndex: Int,
    val startLat: Double,
    val startLon: Double,
    val endLat: Double,
    val endLon: Double,
    val lengthM: Double,
    val rqiScore: Double,
    val eventCount: Int,
    val avgRms: Double
)

@Entity(tableName = "manual_reports")
data class ManualReportEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val issueType: String, // 'POTHOLE', 'BROKEN_ROAD', 'WATERLOGGING', etc.
    val lat: Double,
    val lon: Double,
    val description: String,
    val severity: String, // 'MILD', 'MODERATE', 'DANGEROUS'
    val photoUri: String?,
    val createdAt: Long = System.currentTimeMillis(),
    val synced: Int = 0
)
