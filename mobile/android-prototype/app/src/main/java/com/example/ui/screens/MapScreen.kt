package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.viewmodel.RoadViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    viewModel: RoadViewModel
) {
    val userProfile by viewModel.userProfile.collectAsState()
    val journeys by viewModel.historicJourneys.collectAsState()
    val events by viewModel.detectedEvents.collectAsState()

    var selectedRoad by remember { mutableStateOf<SimulatedRoad?>(null) }
    var mapFilterMode by remember { mutableStateOf("ALL") } // ALL, POTHOLES, ROUGH

    val roadsList = remember {
        listOf(
            SimulatedRoad(
                name = "Carter Road Promenade",
                ward = "H-West Ward, BMC",
                rqi = 85f,
                textureScore = 90f,
                shockScore = 80f,
                eventsCount = 2,
                passes = 64,
                daysUnresolved = 0,
                color = Color(0xFF00B0FF), // Teal/Blue scale
                timeline = listOf("July: 85 RQI", "June: 88 RQI", "May: 92 RQI")
            ),
            SimulatedRoad(
                name = "Linking Road (Bandra)",
                ward = "H-West Ward, BMC",
                rqi = 42f,
                textureScore = 50f,
                shockScore = 34f,
                eventsCount = 14,
                passes = 120,
                daysUnresolved = 18,
                color = Color(0xFFE040FB), // Purple/Violet
                timeline = listOf("July: 42 RQI (Monsoon)", "June: 65 RQI", "May: 78 RQI")
            ),
            SimulatedRoad(
                name = "SV Road, Santa Cruz",
                ward = "K-West Ward, BMC",
                rqi = 28f,
                textureScore = 32f,
                shockScore = 24f,
                eventsCount = 22,
                passes = 98,
                daysUnresolved = 29,
                color = Color(0xFFFF1744), // Magenta/Red
                timeline = listOf("July: 28 RQI (Severe)", "June: 41 RQI", "May: 55 RQI")
            ),
            SimulatedRoad(
                name = "Western Express Highway",
                ward = "Multiple Wards, BMC",
                rqi = 91f,
                textureScore = 94f,
                shockScore = 88f,
                eventsCount = 1,
                passes = 480,
                daysUnresolved = 1,
                color = Color(0xFF00E676), // Green/Teal
                timeline = listOf("July: 91 RQI", "June: 93 RQI", "May: 95 RQI")
            )
        )
    }

    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF12131A),
            Color(0xFF1C1E2C)
        )
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundBrush)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // --- TOP CONTROL BAR ---
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "CIVIC ROAD MAP",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )

                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x0DFFFFFF))
                        .padding(2.dp)
                ) {
                    MapFilterButton("ALL", mapFilterMode == "ALL") { mapFilterMode = "ALL" }
                    MapFilterButton("POTHOLES", mapFilterMode == "POTHOLES") { mapFilterMode = "POTHOLES" }
                    MapFilterButton("ROUGH", mapFilterMode == "ROUGH") { mapFilterMode = "ROUGH" }
                }
            }

            // --- INTERACTIVE MAP CANVAS ---
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(Color(0xFF10121B))
                    .border(1.dp, Color(0x1FFFFFFF))
            ) {
                // Background grid lines represent streets
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height

                    // Drawing mock grid roads
                    drawLine(
                        color = Color(0x0FFFFFFF),
                        start = Offset(0f, h * 0.3f),
                        end = Offset(w, h * 0.3f),
                        strokeWidth = 24f
                    )
                    drawLine(
                        color = Color(0x0FFFFFFF),
                        start = Offset(0f, h * 0.7f),
                        end = Offset(w, h * 0.7f),
                        strokeWidth = 32f
                    )
                    drawLine(
                        color = Color(0x0FFFFFFF),
                        start = Offset(w * 0.3f, 0f),
                        end = Offset(w * 0.3f, h),
                        strokeWidth = 28f
                    )

                    // Draw actual aggregated heatmap tracks
                    // Western Express Highway
                    drawLine(
                        color = Color(0xFF00E676),
                        start = Offset(w * 0.3f, 100f),
                        end = Offset(w * 0.3f, h - 100f),
                        strokeWidth = 14f,
                        cap = StrokeCap.Round
                    )

                    // Carter Road
                    drawLine(
                        color = Color(0xFF00B0FF),
                        start = Offset(50f, h * 0.3f),
                        end = Offset(w - 50f, h * 0.3f),
                        strokeWidth = 12f,
                        cap = StrokeCap.Round
                    )

                    // Linking Road
                    drawLine(
                        color = Color(0xFFE040FB),
                        start = Offset(100f, h * 0.5f),
                        end = Offset(w - 100f, h * 0.5f),
                        strokeWidth = 12f,
                        cap = StrokeCap.Round
                    )

                    // SV Road
                    drawLine(
                        color = Color(0xFFFF1744),
                        start = Offset(50f, h * 0.7f),
                        end = Offset(w - 50f, h * 0.7f),
                        strokeWidth = 14f,
                        cap = StrokeCap.Round
                    )
                }

                // Interactive Overlays
                // Western Express (Green)
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 100.dp)
                        .offset(x = (-30).dp)
                        .background(Color(0xFF00E676), CircleShape)
                        .size(16.dp)
                        .clickable { selectedRoad = roadsList[3] }
                )

                // Carter Rd (Blue)
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(start = 120.dp, top = 180.dp)
                        .background(Color(0xFF00B0FF), CircleShape)
                        .size(16.dp)
                        .clickable { selectedRoad = roadsList[0] }
                )

                // Linking Road (Purple)
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .offset(y = (-40).dp)
                        .background(Color(0xFFE040FB), CircleShape)
                        .size(20.dp)
                        .clickable { selectedRoad = roadsList[1] }
                )

                // SV Road (Red/Magenta)
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 80.dp, bottom = 220.dp)
                        .background(Color(0xFFFF1744), CircleShape)
                        .size(24.dp)
                        .clickable { selectedRoad = roadsList[2] }
                )

                // GPS Current Position Marker
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .offset(x = (-60).dp, y = 40.dp)
                        .border(2.dp, Color.White, CircleShape)
                        .background(Color(0xFF00B0FF), CircleShape)
                        .size(16.dp)
                )

                // Legend
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xE61E2130)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(12.dp)
                ) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text(text = "RQI LEVEL", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                        Spacer(modifier = Modifier.height(4.dp))
                        LegendRow(color = Color(0xFF00E676), text = ">90 Excellent")
                        LegendRow(color = Color(0xFF00B0FF), text = "70-89 Good")
                        LegendRow(color = Color(0xFFE040FB), text = "50-69 Fair")
                        LegendRow(color = Color(0xFFFF1744), text = "<50 Severe")
                    }
                }
            }

            // --- BOTTOM DETAIL SHEET ---
            AnimatedVisibility(
                visible = selectedRoad != null,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                selectedRoad?.let { road ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2130)),
                        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                    ) {
                        Column(
                            modifier = Modifier
                                .padding(16.dp)
                                .verticalScroll(rememberScrollState())
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = road.name,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Text(
                                        text = road.ward,
                                        fontSize = 12.sp,
                                        color = Color.Gray
                                    )
                                }

                                IconButton(onClick = { selectedRoad = null }) {
                                    Icon(Icons.Filled.Close, contentDescription = "Close", tint = Color.Gray)
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Score distribution row
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                MapMetric(title = "ROAD INDEX", value = String.format("%.0f", road.rqi), color = road.color)
                                MapMetric(title = "SHOCK SCORE", value = String.format("%.0f", road.shockScore), color = Color.White)
                                MapMetric(title = "VIBES RMS", value = String.format("%.0f", road.textureScore), color = Color.White)
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Spec: "Timeline of the quality of road updates"
                            Text(
                                text = "MONSOON DEGRADATION TIMELINE",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Gray,
                                letterSpacing = 0.5.sp
                            )
                            Spacer(modifier = Modifier.height(6.dp))

                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                road.timeline.forEach { entry ->
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            Icons.Filled.Circle,
                                            contentDescription = null,
                                            tint = road.color,
                                            modifier = Modifier.size(6.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(text = entry, fontSize = 12.sp, color = Color.LightGray)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Consensus: ${road.passes} Passes • ${road.eventsCount} shocks",
                                    fontSize = 11.sp,
                                    color = Color.Gray
                                )

                                if (road.daysUnresolved > 0) {
                                    Text(
                                        text = "⚠️ Unresolved for ${road.daysUnresolved} days",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFFF1744)
                                    )
                                } else {
                                    Text(
                                        text = "✓ Status: Clean / Maintained",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF00E676)
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

@Composable
fun MapFilterButton(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (isSelected) Color(0xFF64DD17) else Color.Transparent)
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(
            text = text,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = if (isSelected) Color.Black else Color.White
        )
    }
}

@Composable
fun LegendRow(color: Color, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 2.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, CircleShape)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(text = text, fontSize = 8.sp, color = Color.LightGray)
    }
}

@Composable
fun MapMetric(title: String, value: String, color: Color) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
        modifier = Modifier.width(100.dp)
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = title, fontSize = 9.sp, color = Color.Gray, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = color)
        }
    }
}

data class SimulatedRoad(
    val name: String,
    val ward: String = "Ward",
    val rqi: Float,
    val textureScore: Float,
    val shockScore: Float,
    val eventsCount: Int,
    val passes: Int,
    val daysUnresolved: Int,
    val color: Color,
    val timeline: List<String>
)
