package com.example.ui.viewmodel

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.local.*
import com.example.data.model.*
import com.example.data.repository.RoadRepository
import com.example.service.LiveTelemetry
import com.example.service.SensingService
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID

class RoadViewModel(
    private val context: Context,
    private val repository: RoadRepository
) : ViewModel() {

    // --- Authentication State ---
    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _authEmail = MutableStateFlow("")
    val authEmail: StateFlow<String> = _authEmail.asStateFlow()

    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    private val _otpCode = MutableStateFlow("")
    val otpCode: StateFlow<String> = _otpCode.asStateFlow()

    private val _isOtpSent = MutableStateFlow(false)
    val isOtpSent: StateFlow<Boolean> = _isOtpSent.asStateFlow()

    // --- User Profile State ---
    private val _userProfile = MutableStateFlow(UserProfile())
    val userProfile: StateFlow<UserProfile> = _userProfile.asStateFlow()

    // --- Database Data Streams ---
    val historicJourneys: StateFlow<List<JourneyEntity>> = repository.allJourneys
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val detectedEvents: StateFlow<List<RoadEventEntity>> = repository.allEvents
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val manualReports: StateFlow<List<ManualReportEntity>> = repository.allManualReports
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // --- Live Sensing Service Integration ---
    val isTracking: StateFlow<Boolean> = SensingService.isTracking
    val liveTelemetry: StateFlow<LiveTelemetry> = SensingService.liveTelemetry

    // --- Synchronization State ---
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncMessage = MutableStateFlow<String?>(null)
    val syncMessage: StateFlow<String?> = _syncMessage.asStateFlow()

    // --- Donation Contribution State ---
    private val _totalContributionsDonated = MutableStateFlow(12500) // ₹ 12,500 contribution baseline
    val totalContributionsDonated: StateFlow<Int> = _totalContributionsDonated.asStateFlow()

    // --- Email Validation Rule (MANDATORY CONSTRAINT) ---
    fun validateAndSendOtp(email: String): Boolean {
        _authError.value = null
        val trimmed = email.trim().lowercase()
        
        if (trimmed.isEmpty()) {
            _authError.value = "Email address cannot be empty."
            return false
        }

        // Allowed domains check
        val allowedDomains = listOf("gmail.com", "outlook.com", "proton.me", "protonmail.com")
        val emailParts = trimmed.split("@")
        
        if (emailParts.size != 2) {
            _authError.value = "Please enter a valid email format."
            return false
        }

        val domain = emailParts[1]
        if (!allowedDomains.contains(domain)) {
            _authError.value = "Only high-security personal emails (Gmail, Outlook, Proton) are allowed. Temporary or disposable domains are blocked."
            return false
        }

        _authEmail.value = trimmed
        _isOtpSent.value = true
        _authError.value = null
        return true
    }

    fun verifyOtp(enteredCode: String): Boolean {
        if (enteredCode.trim() == "123456" || enteredCode.trim() == "2026") {
            _isLoggedIn.value = true
            _authError.value = null
            // Update profile email
            _userProfile.value = _userProfile.value.copy(email = _authEmail.value)
            return true
        } else {
            _authError.value = "Invalid OTP code. Please enter 123456 or 2026 to proceed."
            return false
        }
    }

    fun logout() {
        _isLoggedIn.value = false
        _isOtpSent.value = false
        _authEmail.value = ""
        _otpCode.value = ""
    }

    // --- Control Trip Sensing ---
    fun startTrip(simulate: Boolean = true) {
        val journeyId = UUID.randomUUID().toString()
        val intent = Intent(context, SensingService::class.java).apply {
            action = SensingService.ACTION_START
            putExtra("JOURNEY_ID", journeyId)
            putExtra("VEHICLE_TYPE", _userProfile.value.vehicleType.name)
            putExtra("MOUNT_POSITION", _userProfile.value.mountPosition.name)
            putExtra("SIMULATING", simulate)
        }
        context.startService(intent)
    }

    fun stopTrip() {
        val intent = Intent(context, SensingService::class.java).apply {
            action = SensingService.ACTION_STOP
        }
        context.startService(intent)
        // Refresh profile stats
        viewModelScope.launch {
            delay(1500) // wait for DB flush
            updateStatsFromDb()
        }
    }

    private fun updateStatsFromDb() {
        val journeys = historicJourneys.value
        val events = detectedEvents.value
        val kmCount = journeys.sumOf { it.distanceM } / 1000f

        _userProfile.value = _userProfile.value.copy(
            totalTrips = journeys.size,
            totalKmScanned = 42.5f + kmCount.toFloat(),
            potentialEventsDetected = 89 + events.size,
            verifiedEventsContributed = 34 + (events.size / 3)
        )
    }

    // --- Preferences configuration ---
    fun setVehicleType(type: VehicleType) {
        _userProfile.value = _userProfile.value.copy(vehicleType = type)
    }

    fun setPhoneMountPosition(position: PhoneMountPosition) {
        _userProfile.value = _userProfile.value.copy(mountPosition = position)
    }

    fun contributeDonation(amount: Int) {
        _totalContributionsDonated.value += amount
        // Unlock badge if high donation contribution
        _userProfile.value = _userProfile.value.copy(
            verifiedEventsContributed = _userProfile.value.verifiedEventsContributed + 1
        )
    }

    // --- Submit Manual Report ---
    fun submitManualReport(
        type: String,
        description: String,
        severity: String,
        lat: Double = 19.0596,
        lon: Double = 72.8295
    ) {
        val report = ManualReportEntity(
            id = UUID.randomUUID().toString(),
            userId = _userProfile.value.userId,
            issueType = type,
            lat = lat,
            lon = lon,
            description = description,
            severity = severity,
            photoUri = null
        )
        viewModelScope.launch {
            repository.insertManualReport(report)
        }
    }

    // --- Database Trigger Sync ---
    fun triggerSync() {
        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = "Connecting to Better Roads server..."
            try {
                val result = repository.syncPendingData()
                _syncMessage.value = result.message
            } catch (e: Exception) {
                _syncMessage.value = "Sync failed: ${e.message}"
            } finally {
                _isSyncing.value = false
            }
        }
    }

    fun clearSyncMessage() {
        _syncMessage.value = null
    }

    // Helper delay extensions
    private suspend fun delay(timeMillis: Long) {
        kotlinx.coroutines.delay(timeMillis)
    }
}

class ViewModelFactory(
    private val context: Context,
    private val repository: RoadRepository
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(RoadViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return RoadViewModel(context, repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
