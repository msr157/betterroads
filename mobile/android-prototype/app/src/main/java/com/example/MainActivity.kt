package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Leaderboard
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModelProvider
import com.example.data.local.AppDatabase
import com.example.data.local.JourneyEntity
import com.example.data.repository.RoadRepository
import com.example.ui.screens.*
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.viewmodel.RoadViewModel
import com.example.ui.viewmodel.ViewModelFactory

class MainActivity : ComponentActivity() {

    private lateinit var viewModel: RoadViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Initialize Local DB & Repositories
        val database = AppDatabase.getDatabase(applicationContext)
        val repository = RoadRepository(database.roadDao())
        
        // Instantiate ViewModel
        viewModel = ViewModelProvider(
            this,
            ViewModelFactory(applicationContext, repository)
        )[RoadViewModel::class.java]

        setContent {
            MyApplicationTheme {
                val isLoggedIn by viewModel.isLoggedIn.collectAsState()
                val isTracking by viewModel.isTracking.collectAsState()
                val historicJourneys by viewModel.historicJourneys.collectAsState()

                // State-based navigation variables
                var currentTab by remember { mutableStateOf("HOME") } // HOME, MAP, LEADERBOARD, PROFILE
                var isReportingManual by remember { mutableStateOf(false) }
                var lastCompletedJourney by remember { mutableStateOf<JourneyEntity?>(null) }

                // Side effect to capture completed journey details once a scan finishes
                LaunchedEffect(key1 = isTracking) {
                    if (!isTracking && historicJourneys.isNotEmpty()) {
                        val latest = historicJourneys.firstOrNull()
                        if (latest != null && latest.endedAt != null) {
                            lastCompletedJourney = latest
                        }
                    }
                }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF12131A)
                ) {
                    when {
                        // 1. Splash & Auth Onboarding Flows
                        !isLoggedIn -> {
                            SplashOnboardingScreen(
                                viewModel = viewModel,
                                onOnboardingComplete = {
                                    // Complete consent/permissions and land on Home
                                    viewModel.verifyOtp("123456") 
                                }
                            )
                        }

                        // 2. Active Sensor Scanning View (Full Screen Cover)
                        isTracking -> {
                            LiveScanScreen(
                                viewModel = viewModel,
                                onStopScan = {
                                    viewModel.stopTrip()
                                }
                            )
                        }

                        // 3. Completed Journey Summary Overlay
                        lastCompletedJourney != null -> {
                            TripSummaryScreen(
                                viewModel = viewModel,
                                journey = lastCompletedJourney,
                                onClose = {
                                    lastCompletedJourney = null
                                    currentTab = "HOME"
                                }
                            )
                        }

                        // 4. Manual Road Issue Reporting Overlay
                        isReportingManual -> {
                            ManualReportScreen(
                                viewModel = viewModel,
                                onReportSubmitted = {
                                    isReportingManual = false
                                },
                                onBack = {
                                    isReportingManual = false
                                }
                            )
                        }

                        // 5. Main App Scaffold Container (Bottom Bar Navigation)
                        else -> {
                            Scaffold(
                                bottomBar = {
                                    NavigationBar(
                                        containerColor = Color(0xFF12131A),
                                        tonalElevation = NavigationBarDefaults.Elevation,
                                        modifier = Modifier.navigationBarsPadding()
                                    ) {
                                        NavigationBarItem(
                                            selected = currentTab == "HOME",
                                            onClick = { currentTab = "HOME" },
                                            icon = { Icon(Icons.Filled.Home, contentDescription = "Home") },
                                            label = { Text("Home", fontSize = 11.sp) },
                                            colors = NavigationBarItemDefaults.colors(
                                                selectedIconColor = Color(0xFF64DD17),
                                                selectedTextColor = Color(0xFF64DD17),
                                                indicatorColor = Color(0x1F64DD17),
                                                unselectedIconColor = Color.Gray,
                                                unselectedTextColor = Color.Gray
                                            ),
                                            modifier = Modifier.testTag("nav_home_tab")
                                        )

                                        NavigationBarItem(
                                            selected = currentTab == "MAP",
                                            onClick = { currentTab = "MAP" },
                                            icon = { Icon(Icons.Filled.Map, contentDescription = "Map") },
                                            label = { Text("Map", fontSize = 11.sp) },
                                            colors = NavigationBarItemDefaults.colors(
                                                selectedIconColor = Color(0xFF64DD17),
                                                selectedTextColor = Color(0xFF64DD17),
                                                indicatorColor = Color(0x1F64DD17),
                                                unselectedIconColor = Color.Gray,
                                                unselectedTextColor = Color.Gray
                                            ),
                                            modifier = Modifier.testTag("nav_map_tab")
                                        )

                                        NavigationBarItem(
                                            selected = currentTab == "LEADERBOARD",
                                            onClick = { currentTab = "LEADERBOARD" },
                                            icon = { Icon(Icons.Filled.Leaderboard, contentDescription = "Leaderboard") },
                                            label = { Text("Ranking", fontSize = 11.sp) },
                                            colors = NavigationBarItemDefaults.colors(
                                                selectedIconColor = Color(0xFF64DD17),
                                                selectedTextColor = Color(0xFF64DD17),
                                                indicatorColor = Color(0x1F64DD17),
                                                unselectedIconColor = Color.Gray,
                                                unselectedTextColor = Color.Gray
                                            ),
                                            modifier = Modifier.testTag("nav_ranking_tab")
                                        )

                                        NavigationBarItem(
                                            selected = currentTab == "PROFILE",
                                            onClick = { currentTab = "PROFILE" },
                                            icon = { Icon(Icons.Filled.Person, contentDescription = "Profile") },
                                            label = { Text("Profile", fontSize = 11.sp) },
                                            colors = NavigationBarItemDefaults.colors(
                                                selectedIconColor = Color(0xFF64DD17),
                                                selectedTextColor = Color(0xFF64DD17),
                                                indicatorColor = Color(0x1F64DD17),
                                                unselectedIconColor = Color.Gray,
                                                unselectedTextColor = Color.Gray
                                            ),
                                            modifier = Modifier.testTag("nav_profile_tab")
                                        )
                                    }
                                },
                                contentWindowInsets = WindowInsets(0, 0, 0, 0)
                            ) { innerPadding ->
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .padding(innerPadding)
                                ) {
                                    when (currentTab) {
                                        "HOME" -> {
                                            HomeScreen(
                                                viewModel = viewModel,
                                                onStartScan = { simulate ->
                                                    viewModel.startTrip(simulate)
                                                },
                                                onReportManual = {
                                                    isReportingManual = true
                                                }
                                            )
                                        }
                                        "MAP" -> {
                                            MapScreen(viewModel = viewModel)
                                        }
                                        "LEADERBOARD" -> {
                                            LeaderboardScreen(viewModel = viewModel)
                                        }
                                        "PROFILE" -> {
                                            ProfileSettingsScreen(
                                                viewModel = viewModel,
                                                onLogout = {
                                                    currentTab = "HOME"
                                                }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
