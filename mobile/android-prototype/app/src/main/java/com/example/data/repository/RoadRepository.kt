package com.example.data.repository

import com.example.data.local.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.delay

class RoadRepository(private val roadDao: RoadDao) {

    // Streams
    val allJourneys: Flow<List<JourneyEntity>> = roadDao.getAllJourneys()
    val allEvents: Flow<List<RoadEventEntity>> = roadDao.getAllEvents()
    val allManualReports: Flow<List<ManualReportEntity>> = roadDao.getAllManualReports()

    suspend fun getJourneyById(id: String): JourneyEntity? = roadDao.getJourneyById(id)

    fun getSegmentsForJourney(journeyId: String): Flow<List<JourneySegmentEntity>> =
        roadDao.getSegmentsForJourney(journeyId)

    fun getEventsForJourney(journeyId: String): Flow<List<RoadEventEntity>> =
        roadDao.getEventsForJourney(journeyId)

    suspend fun insertJourney(journey: JourneyEntity) {
        roadDao.insertJourney(journey)
    }

    suspend fun updateJourney(journey: JourneyEntity) {
        roadDao.updateJourney(journey)
    }

    suspend fun deleteJourney(id: String) {
        roadDao.deleteJourney(id)
    }

    suspend fun insertEvent(event: RoadEventEntity) {
        roadDao.insertEvent(event)
    }

    suspend fun insertEvents(events: List<RoadEventEntity>) {
        roadDao.insertEvents(events)
    }

    suspend fun insertSegments(segments: List<JourneySegmentEntity>) {
        roadDao.insertSegments(segments)
    }

    suspend fun insertManualReport(report: ManualReportEntity) {
        roadDao.insertManualReport(report)
    }

    // --- Mock Backend Sync Queue ---
    suspend fun syncPendingData(): SyncResult {
        delay(2000) // Simulate network delay

        val unsyncedJourneys = roadDao.getUnsyncedJourneys()
        val unsyncedEvents = roadDao.getUnsyncedEvents()
        val unsyncedReports = roadDao.getUnsyncedManualReports()

        if (unsyncedJourneys.isEmpty() && unsyncedEvents.isEmpty() && unsyncedReports.isEmpty()) {
            return SyncResult(success = true, message = "Everything is already synced!")
        }

        // Mark journeys synced
        unsyncedJourneys.forEach { journey ->
            val updated = journey.copy(synced = 1)
            roadDao.insertJourney(updated)
        }

        // Mark events synced
        if (unsyncedEvents.isNotEmpty()) {
            roadDao.markEventsSynced(unsyncedEvents.map { it.id })
        }

        // Mark reports synced
        unsyncedReports.forEach { report ->
            roadDao.markReportSynced(report.id)
        }

        val totalSyncedCount = unsyncedJourneys.size + unsyncedEvents.size + unsyncedReports.size
        return SyncResult(
            success = true,
            message = "Successfully synced $totalSyncedCount records ($unsyncedJourneys.size journeys, ${unsyncedEvents.size} events, ${unsyncedReports.size} reports) to PostGIS server!"
        )
    }
}

data class SyncResult(val success: Boolean, val message: String)
