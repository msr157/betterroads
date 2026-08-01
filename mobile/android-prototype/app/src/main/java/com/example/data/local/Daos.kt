package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface RoadDao {

    // --- Journeys ---
    @Query("SELECT * FROM journeys ORDER BY startedAt DESC")
    fun getAllJourneys(): Flow<List<JourneyEntity>>

    @Query("SELECT * FROM journeys WHERE id = :id")
    suspend fun getJourneyById(id: String): JourneyEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJourney(journey: JourneyEntity)

    @Update
    suspend fun updateJourney(journey: JourneyEntity)

    @Query("DELETE FROM journeys WHERE id = :id")
    suspend fun deleteJourney(id: String)

    @Query("SELECT * FROM journeys WHERE synced = 0")
    suspend fun getUnsyncedJourneys(): List<JourneyEntity>

    // --- Road Events ---
    @Query("SELECT * FROM road_events ORDER BY timestamp DESC")
    fun getAllEvents(): Flow<List<RoadEventEntity>>

    @Query("SELECT * FROM road_events WHERE journeyId = :journeyId ORDER BY timestamp ASC")
    fun getEventsForJourney(journeyId: String): Flow<List<RoadEventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvent(event: RoadEventEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvents(events: List<RoadEventEntity>)

    @Query("SELECT * FROM road_events WHERE synced = 0")
    suspend fun getUnsyncedEvents(): List<RoadEventEntity>

    @Query("UPDATE road_events SET synced = 1 WHERE id IN (:eventIds)")
    suspend fun markEventsSynced(eventIds: List<String>)

    // --- Journey Segments ---
    @Query("SELECT * FROM journey_segments WHERE journeyId = :journeyId ORDER BY segmentIndex ASC")
    fun getSegmentsForJourney(journeyId: String): Flow<List<JourneySegmentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSegments(segments: List<JourneySegmentEntity>)

    // --- Manual Reports ---
    @Query("SELECT * FROM manual_reports ORDER BY createdAt DESC")
    fun getAllManualReports(): Flow<List<ManualReportEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertManualReport(report: ManualReportEntity)

    @Query("SELECT * FROM manual_reports WHERE synced = 0")
    suspend fun getUnsyncedManualReports(): List<ManualReportEntity>

    @Query("UPDATE manual_reports SET synced = 1 WHERE id = :reportId")
    suspend fun markReportSynced(reportId: String)
}
