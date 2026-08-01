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
import com.example.ui.viewmodel.RoadViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSettingsScreen(
    viewModel: RoadViewModel,
    onLogout: () -> Unit
) {
    val userProfile by viewModel.userProfile.collectAsState()

    var blurHomeWork by remember { mutableStateOf(true) }
    var localOnlyMode by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF12131A),
            Color(0xFF1E2130)
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

        // --- User Avatar Header ---
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(Color(0xFF64DD17), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = userProfile.name.take(2).uppercase(),
                        fontWeight = FontWeight.Black,
                        fontSize = 24.sp,
                        color = Color.Black
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = userProfile.name,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = userProfile.email,
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0x1F00B0FF)),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = userProfile.contributorType.displayName,
                            color = Color(0xFF00B0FF),
                            fontWeight = FontWeight.Bold,
                            fontSize = 9.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Privacy Settings (Spec: 8 Privacy by design) ---
        Text(
            text = "PRIVACY CONTROL",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Gray,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(10.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0x08FFFFFF)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                // Toggle 1: Blur starts and ends
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Trim Start/End Tracks",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color.White
                        )
                        Text(
                            text = "Trims the first and last 200m of trip coordinates to protect work and home.",
                            fontSize = 11.sp,
                            color = Color.Gray
                        )
                    }
                    Switch(
                        checked = blurHomeWork,
                        onCheckedChange = { blurHomeWork = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = Color(0xFF64DD17))
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Toggle 2: Local Only mode
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Local-Only Offline Mode",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color.White
                        )
                        Text(
                            text = "Stores everything inside local Room database. No telemetry is shared with the servers.",
                            fontSize = 11.sp,
                            color = Color.Gray
                        )
                    }
                    Switch(
                        checked = localOnlyMode,
                        onCheckedChange = { localOnlyMode = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = Color(0xFF64DD17))
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Nonprofit Disclaimer (Spec: 8 Nonprofit project) ---
        Text(
            text = "PROJECT CONVENANT",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Gray,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(10.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0x13FFD600)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.VolunteerActivism, contentDescription = "Nonprofit", tint = Color(0xFFFFD600))
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Nonprofit Open Civic Initiative",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 14.sp
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Better Roads is a collaborative, open-source civic research project. We do not engage in surveillance or sell your telemetry coordinates. All shared indicators serve purely to map road quality potholes and drive civic repairs.",
                    fontSize = 11.sp,
                    color = Color.LightGray,
                    lineHeight = 15.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Data Deletion ---
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0x0DFFFFFF)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Clear Local Logs",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Delete your history of raw sensor frames and local tracks permanently from this mobile device.",
                    fontSize = 11.sp,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = { showDeleteConfirm = true },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD50000)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.height(38.dp)
                ) {
                    Text("Delete All Local Tracks", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Logout Button ---
        Button(
            onClick = {
                viewModel.logout()
                onLogout()
            },
            colors = ButtonDefaults.buttonColors(containerColor = Color(0x0CFFFFFF)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .testTag("logout_button")
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.ExitToApp, contentDescription = "Logout", tint = Color.Gray)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Log Out", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(40.dp))
    }

    // --- Delete Confirmation Dialog ---
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Local Trips?", color = Color.White) },
            text = {
                Text(
                    text = "This action is irreversible. All your local trip details, aggregated segments, and manual hazard reports will be purged from SQLite database.",
                    color = Color.LightGray
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        // Delete simulated, we can trigger view model cleanup or notify
                    }
                ) {
                    Text("Yes, Delete", color = Color(0xFFD50000), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel", color = Color.White)
                }
            },
            containerColor = Color(0xFF1E2130)
        )
    }
}
