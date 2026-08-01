package com.example.data.model

enum class VehicleType(val displayName: String, val baselineRms: Float) {
    CAR("Car / Sedan", 0.35f),
    AUTO_RICKSHAW("Auto Rickshaw", 1.10f),
    TWO_WHEELER("Bike / Scooter", 0.60f),
    BUS("Bus", 0.70f),
    TRUCK("Truck", 0.80f),
    WALKING("Walking", 0.15f),
    OTHER("Other", 0.50f)
}

enum class PhoneMountPosition(val displayName: String) {
    DASHBOARD_MOUNT("Dashboard Mount"),
    BIKE_HANDLE_MOUNT("Bike Handle Mount"),
    CUP_HOLDER("Cup Holder"),
    IN_HAND("In Hand"),
    POCKET("Pocket"),
    BAG("Bag"),
    UNKNOWN("Unknown / Stable")
}

enum class ContributorType(val displayName: String) {
    CITIZEN("Citizen"),
    RIDER("Rider"),
    DRIVER("Driver"),
    CAB_DRIVER("Cab Driver"),
    DELIVERY_PARTNER("Delivery Partner"),
    VOLUNTEER("Volunteer")
}

enum class RoadEventType(val displayName: String, val emoji: String) {
    POTHOLE("Shock (Pothole Candidate)", "⚠️"),
    BUMP("Bump", "📈"),
    SPEED_BREAKER("Speed Breaker", "🛑"),
    ROUGH_ROAD("Rough Road Section", "〰️"),
    SWERVE("Swerve / Evasion", "↪️"),
    HARD_BRAKING("Hard Braking", "⚠️"),
    VIBRATION("Surface Vibration", "📶"),
    STRUCTURAL_PERIODIC("Bridge Expansion Joint", "🌉")
}

enum class RoadQualityBand(val displayName: String, val minScore: Float, val colorHex: Long) {
    EXCELLENT("Excellent", 90f, 0xFF00C853), // Green
    GOOD("Good", 70f, 0xFF64DD17),      // Light Green
    FAIR("Fair", 50f, 0xFFFFD600),      // Yellow
    POOR("Poor", 30f, 0xFFFF6D00),      // Orange
    VERY_POOR("Very Poor", 0f, 0xFFD50000) // Red
}

data class UserProfile(
    val userId: String = "contributor_mumbai_1",
    val name: String = "Rage Mayank",
    val email: String = "ragemayank@gmail.com",
    val phone: String = "+91 98765 43210",
    val city: String = "Mumbai",
    val contributorType: ContributorType = ContributorType.CITIZEN,
    val vehicleType: VehicleType = VehicleType.CAR,
    val mountPosition: PhoneMountPosition = PhoneMountPosition.DASHBOARD_MOUNT,
    val totalTrips: Int = 14,
    val totalKmScanned: Float = 42.5f,
    val potentialEventsDetected: Int = 89,
    val verifiedEventsContributed: Int = 34,
    val cityRank: Int = 18,
    val streakDays: Int = 5
)
