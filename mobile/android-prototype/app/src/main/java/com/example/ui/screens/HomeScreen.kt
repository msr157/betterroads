package com.example.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.PhoneMountPosition
import com.example.data.model.VehicleType
import com.example.ui.viewmodel.RoadViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: RoadViewModel,
    onStartScan: (Boolean) -> Unit, // Boolean: true for simulation, false for hardware
    onReportManual: () -> Unit
) {
    val userProfile by viewModel.userProfile.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val syncMessage by viewModel.syncMessage.collectAsState()
    val historicJourneys by viewModel.historicJourneys.collectAsState()

    var showVehicleSheet by remember { mutableStateOf(false) }
    var showMountSheet by remember { mutableStateOf(false) }
    var showStartTripDialog by remember { mutableStateOf(false) }

    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF12131A),
            Color(0xFF181B26)
        )
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundBrush)
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        // --- Header ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Welcome, ${userProfile.name}",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "${userProfile.city} Pilot Contributor",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }

            // Sync Indicator / Button
            IconButton(
                onClick = { viewModel.triggerSync() },
                modifier = Modifier
                    .background(Color(0x0CFFFFFF), CircleShape)
                    .testTag("sync_data_button")
            ) {
                if (isSyncing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp,
                        color = Color(0xFF64DD17)
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.Sync,
                        contentDescription = "Sync Data",
                        tint = if (historicJourneys.any { it.synced == 0 }) Color(0xFFFFD600) else Color.White
                    )
                }
            }
        }

        syncMessage?.let { msg ->
            Spacer(modifier = Modifier.height(12.dp))
            Snackbar(
                action = {
                    TextButton(onClick = { viewModel.clearSyncMessage() }) {
                        Text("OK", color = Color(0xFF64DD17))
                    }
                },
                modifier = Modifier.padding(2.dp)
            ) {
                Text(text = msg, fontSize = 12.sp)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // --- Core City Road Health Score ---
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2130)),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "MUMBAI ROAD INDEX",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        letterSpacing = 1.sp
                    )
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0x1F64DD17)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "GOOD",
                            color = Color(0xFF64DD17),
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "78",
                        fontSize = 64.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                        lineHeight = 64.sp
                    )
                    Text(
                        text = "/100",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Consensus from 4,210 verified scans this month.",
                    fontSize = 12.sp,
                    color = Color.LightGray,
                    textAlign = TextAlign.Center
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // --- Action CTAs ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = { showStartTripDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64DD17)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .weight(1f)
                    .height(64.dp)
                    .testTag("start_road_scan_button")
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.DirectionsRun,
                        contentDescription = "Scan Icon",
                        tint = Color.Black
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Start Scan",
                        color = Color.Black,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }

            Button(
                onClick = { onReportManual() },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00B0FF)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .weight(1f)
                    .height(64.dp)
                    .testTag("manual_report_button")
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.AddAPhoto,
                        contentDescription = "Report Icon",
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Report Issue",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // --- Device Config Row ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Vehicle Select Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .weight(1f)
                    .clickable { showVehicleSheet = true }
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(text = "VEHICLE TYPE", fontSize = 10.sp, color = Color.Gray)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Filled.DirectionsCar,
                            contentDescription = "Vehicle",
                            tint = Color(0xFF64DD17),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = userProfile.vehicleType.displayName,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }

            // Mounting Position Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .weight(1f)
                    .clickable { showMountSheet = true }
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(text = "MOUNTING POSITION", fontSize = 10.sp, color = Color.Gray)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Filled.Smartphone,
                            contentDescription = "Mount",
                            tint = Color(0xFFFFD600),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = userProfile.mountPosition.displayName,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Personal Contribution Summary Stats ---
        Text(
            text = "YOUR CIVIC IMPACT",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Gray,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(10.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Filled.AltRoute, contentDescription = "Dist", tint = Color(0xFF64DD17))
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = String.format("%.1f km", userProfile.totalKmScanned),
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 16.sp
                    )
                    Text(text = "Scanned", fontSize = 10.sp, color = Color.Gray)
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Filled.Warning, contentDescription = "Events", tint = Color(0xFFFFD600))
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = userProfile.potentialEventsDetected.toString(),
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 16.sp
                    )
                    Text(text = "Shock Spikes", fontSize = 10.sp, color = Color.Gray)
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Filled.VerifiedUser, contentDescription = "Verified", tint = Color(0xFF00B0FF))
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = userProfile.verifiedEventsContributed.toString(),
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 16.sp
                    )
                    Text(text = "Verified", fontSize = 10.sp, color = Color.Gray)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Live Alerts ---
        Text(
            text = "NEARBY POTHOLE ALERTS",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Gray,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(10.dp))

        PotholeAlertRow(
            location = "Linking Road, Bandra West",
            distance = "250m away",
            severity = "Severe damage",
            reportsCount = "12 passes"
        )
        PotholeAlertRow(
            location = "SV Road, Santa Cruz",
            distance = "1.2 km away",
            severity = "Moderate roughness",
            reportsCount = "4 passes"
        )

        Spacer(modifier = Modifier.height(30.dp))
    }

    // --- Bottom Sheet Dialog: Vehicle Selection ---
    if (showVehicleSheet) {
        AlertDialog(
            onDismissRequest = { showVehicleSheet = false },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showVehicleSheet = false }) { Text("Dismiss", color = Color.White) }
            },
            title = { Text("Select Vehicle Type", color = Color.White) },
            text = {
                Column {
                    VehicleType.values().forEach { v ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel.setVehicleType(v)
                                    showVehicleSheet = false
                                }
                                .padding(vertical = 12.dp, horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Filled.DirectionsCar,
                                contentDescription = null,
                                tint = if (userProfile.vehicleType == v) Color(0xFF64DD17) else Color.Gray
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = v.displayName,
                                color = if (userProfile.vehicleType == v) Color(0xFF64DD17) else Color.White,
                                fontWeight = if (userProfile.vehicleType == v) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            },
            containerColor = Color(0xFF1E2130)
        )
    }

    // --- Bottom Sheet Dialog: Mounting Position ---
    if (showMountSheet) {
        AlertDialog(
            onDismissRequest = { showMountSheet = false },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showMountSheet = false }) { Text("Dismiss", color = Color.White) }
            },
            title = { Text("Phone Mounting Placement", color = Color.White) },
            text = {
                Column {
                    PhoneMountPosition.values().forEach { m ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel.setPhoneMountPosition(m)
                                    showMountSheet = false
                                }
                                .padding(vertical = 12.dp, horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Smartphone,
                                contentDescription = null,
                                tint = if (userProfile.mountPosition == m) Color(0xFFFFD600) else Color.Gray
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = m.displayName,
                                color = if (userProfile.mountPosition == m) Color(0xFFFFD600) else Color.White,
                                fontWeight = if (userProfile.mountPosition == m) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            },
            containerColor = Color(0xFF1E2130)
        )
    }

    // --- Start Scan Dialog Choose Mode ---
    if (showStartTripDialog) {
        AlertDialog(
            onDismissRequest = { showStartTripDialog = false },
            title = { Text("Confirm Road Scan Session", color = Color.White) },
            text = {
                Text(
                    text = "Would you like to run in real tracking mode (requires fine GPS and accelerometer) or use the simulated test drive overlay?",
                    color = Color.LightGray
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showStartTripDialog = false
                        onStartScan(true) // Start Simulated
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64DD17))
                ) {
                    Text("Mumbai Simulation", color = Color.Black)
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = {
                        showStartTripDialog = false
                        onStartScan(false) // Start Real Hardware
                    },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                ) {
                    Text("Real Sensors")
                }
            },
            containerColor = Color(0xFF1E2130)
        )
    }
}

@Composable
fun PotholeAlertRow(
    location: String,
    distance: String,
    severity: String,
    reportsCount: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(Color(0x1FD50000), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Warning,
                    contentDescription = null,
                    tint = Color(0xFFD50000),
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(text = location, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text(text = "$distance • $severity", fontSize = 11.sp, color = Color.Gray)
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
                shape = RoundedCornerShape(6.dp)
            ) {
                Text(
                    text = reportsCount,
                    fontSize = 10.sp,
                    color = Color.LightGray,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}
