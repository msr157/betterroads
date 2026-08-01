package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.JourneyEntity
import com.example.ui.viewmodel.RoadViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TripSummaryScreen(
    viewModel: RoadViewModel,
    journey: JourneyEntity?,
    onClose: () -> Unit
) {
    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF12131A),
            Color(0xFF1E2130)
        )
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Trip Completed", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { onClose() }) {
                        Icon(imageVector = Icons.Filled.Close, contentDescription = "Close", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF12131A))
            )
        },
        containerColor = Color(0xFF12131A)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(backgroundBrush)
                .padding(innerPadding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (journey == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No trip data found.", color = Color.White)
                }
            } else {
                Spacer(modifier = Modifier.height(16.dp))

                // Score Card
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0x0DFFFFFF)),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "ROAD QUALITY SCORE (RQI)",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.Gray,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = String.format("%.0f", journey.rqiScore),
                            fontSize = 64.sp,
                            fontWeight = FontWeight.Black,
                            color = when {
                                journey.rqiScore >= 80 -> Color(0xFF64DD17)
                                journey.rqiScore >= 50 -> Color(0xFFFFD600)
                                else -> Color(0xFFD50000)
                            }
                        )
                        Text(
                            text = when {
                                journey.rqiScore >= 80 -> "Excellent/Smooth Segment"
                                journey.rqiScore >= 50 -> "Fair / Moderate Bumps"
                                else -> "Poor / Severe Shocks Detected"
                            },
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 14.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Stats grid
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SummaryStatCard(
                        icon = Icons.Filled.Timeline,
                        title = "Distance Scan",
                        value = String.format("%.2f km", journey.distanceM / 1000f),
                        modifier = Modifier.weight(1f)
                    )
                    SummaryStatCard(
                        icon = Icons.Filled.Timer,
                        title = "Duration",
                        value = String.format("%02d:%02d", journey.durationS / 60, journey.durationS % 60),
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SummaryStatCard(
                        icon = Icons.Filled.Speed,
                        title = "Avg Speed",
                        value = String.format("%.1f km/h", journey.avgSpeedKmh),
                        modifier = Modifier.weight(1f)
                    )
                    SummaryStatCard(
                        icon = Icons.Filled.Warning,
                        title = "Discrete Shocks",
                        value = "${journey.eventCount} events",
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Spec: "Sync Payload Structure"
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.CloudUpload, contentDescription = "Sync", tint = Color(0xFF64DD17))
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "Pending Backend Cloud Sync",
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 15.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "This trip has been saved locally. It will be compressed and synchronized to the PostGIS server next time you connect to WiFi or trigger manual sync.",
                            fontSize = 12.sp,
                            color = Color.LightGray,
                            lineHeight = 16.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                viewModel.triggerSync()
                                onClose()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64DD17)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp)
                                .testTag("sync_trip_summary_button")
                        ) {
                            Text("Sync To Cloud Now", color = Color.Black, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(30.dp))
            }
        }
    }
}

@Composable
fun SummaryStatCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0x05FFFFFF)),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = title, fontSize = 11.sp, color = Color.Gray)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}
