package com.example.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.RoadEventType
import com.example.service.LiveEvent
import com.example.ui.viewmodel.RoadViewModel

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun LiveScanScreen(
    viewModel: RoadViewModel,
    onStopScan: () -> Unit
) {
    val telemetry by viewModel.liveTelemetry.collectAsState()
    val isTracking by viewModel.isTracking.collectAsState()

    // Keep list of session events to display in-session ticker
    val sessionEvents = remember { mutableStateListOf<LiveEvent>() }

    // Observe telemetry events to update ticker
    LaunchedEffect(key1 = telemetry.latestEvent) {
        telemetry.latestEvent?.let { event ->
            if (sessionEvents.none { it.timestamp == event.timestamp }) {
                sessionEvents.add(0, event)
            }
        }
    }

    // Timer formatting mm:ss
    val minutes = telemetry.elapsedSeconds / 60
    val seconds = telemetry.elapsedSeconds % 60
    val formattedTime = String.format("%02d:%02d", minutes, seconds)

    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF0F1015),
            Color(0xFF1C0D26) // Deep warning purple aura
        )
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundBrush)
            .safeDrawingPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // --- TOP HEADER ---
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF64DD17))
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (telemetry.isSimulating) "MUMBAI PILOT SIMULATOR" else "LIVE HARDWARE SCAN",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF64DD17),
                            letterSpacing = 1.sp
                        )
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0x1F00B0FF)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = formattedTime,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = Color(0xFF00B0FF),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // --- SPEED & DISTANCE METRICS ---
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Speed
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = String.format("%.0f", telemetry.speedKmh),
                            fontSize = 64.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            lineHeight = 64.sp
                        )
                        Text(
                            text = "SPEED KM/H",
                            fontSize = 10.sp,
                            color = Color.Gray,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // Divider
                    Box(
                        modifier = Modifier
                            .width(1.dp)
                            .height(50.dp)
                            .background(Color(0x1FFFFFFF))
                    )

                    // Distance
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = String.format("%.2f", telemetry.distanceM / 1000f),
                            fontSize = 42.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            lineHeight = 42.sp
                        )
                        Text(
                            text = "DISTANCE SCAN (KM)",
                            fontSize = 10.sp,
                            color = Color.Gray,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // --- CENTER: LIVE RMS GRAPH / GAUGE & UNMOUNTED ALERT ---
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Mounting Instability Banner (Spec: 3.3 Mounting Quality Gate)
                AnimatedVisibility(
                    visible = telemetry.isUnmounted,
                    enter = fadeIn() + slideInVertically(),
                    exit = fadeOut() + slideOutVertically()
                ) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF3E2723)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 16.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Filled.ReportProblem,
                                contentDescription = "Unstable Mount Warning",
                                tint = Color(0xFFFFD600),
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = "PHONE UNSTABLE / UNMOUNTED",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFFFD600)
                                )
                                Text(
                                    text = "Passive scoring paused. Secure phone inside holder to resume quality maps.",
                                    fontSize = 10.sp,
                                    color = Color.LightGray,
                                    lineHeight = 14.sp
                                )
                            }
                        }
                    }
                }

                // Live Vibration Intensity Gauge (RMS)
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "LIVE VIBRATION LEVEL (RMS)",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Gray
                            )
                            Text(
                                text = String.format("%.2f m/s²", telemetry.liveRms),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))

                        // Dynamic Level bar
                        val rmsNormalised = (telemetry.liveRms / 3f).coerceIn(0f, 1f)
                        val barColor = when {
                            telemetry.liveRms > 1.8f -> Color(0xFFD50000) // Red (Severe)
                            telemetry.liveRms > 0.8f -> Color(0xFFFF6D00) // Orange (Rough)
                            else -> Color(0xFF64DD17) // Green (Smooth)
                        }

                        LinearProgressIndicator(
                            progress = rmsNormalised,
                            color = barColor,
                            trackColor = Color(0x1FFFFFFF),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(12.dp)
                                .clip(RoundedCornerShape(6.dp))
                        )

                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Smooth", fontSize = 9.sp, color = Color.Gray)
                            Text(text = "Moderate Roughness", fontSize = 9.sp, color = Color.Gray)
                            Text(text = "Extreme Shock", fontSize = 9.sp, color = Color.Gray)
                        }
                    }
                }
            }

            // --- BOTTOM: EVENT TICKER FEED & ACTION BUTTONS ---
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
            ) {
                Text(
                    text = "SESSION EVENTS TICKER (${telemetry.eventsCount})",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Gray,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))

                Box(
                    modifier = Modifier
                        .height(160.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x0CFFFFFF))
                ) {
                    if (sessionEvents.isEmpty()) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Map,
                                contentDescription = null,
                                tint = Color.DarkGray,
                                modifier = Modifier.size(32.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Drive steady. Shocks are parsed automatically.",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.padding(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(sessionEvents) { e ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0x08FFFFFF), RoundedCornerShape(8.dp))
                                        .padding(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(text = e.type.emoji, fontSize = 18.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = e.type.displayName,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                        Text(
                                            text = String.format("Severity: %.2f • Coordinates: %.5f, %.5f", e.severity, e.lat, e.lon),
                                            fontSize = 10.sp,
                                            color = Color.LightGray
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // --- TRIP CONTROLS ---
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // TAG MANUAL POINT (Spec: 4 manual event tag button)
                Button(
                    onClick = {
                        // Let's drop a user manual marker
                        viewModel.submitManualReport(
                            type = "POTHOLE",
                            description = "User manual impact marker tag",
                            severity = "MODERATE"
                        )
                        // Trigger event simulation in list
                        val now = System.currentTimeMillis()
                        sessionEvents.add(
                            0,
                            LiveEvent(
                                type = RoadEventType.POTHOLE,
                                severity = 0.5,
                                lat = 19.0596,
                                lon = 72.8295,
                                timestamp = now
                            )
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFD600)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .height(54.dp)
                        .weight(1f)
                        .padding(end = 8.dp)
                        .testTag("tag_manual_event_button")
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.PinDrop, contentDescription = "Pin Drop", tint = Color.Black)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Tag Shock", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }

                // STOP BUTTON
                Button(
                    onClick = { onStopScan() },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD50000)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .height(54.dp)
                        .weight(1f)
                        .padding(start = 8.dp)
                        .testTag("stop_sensing_button")
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Stop, contentDescription = "Stop", tint = Color.White)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Stop Trip", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
