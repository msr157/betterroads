package com.example.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
fun ManualReportScreen(
    viewModel: RoadViewModel,
    onReportSubmitted: () -> Unit,
    onBack: () -> Unit
) {
    var issueType by remember { mutableStateOf("POTHOLE") }
    var description by remember { mutableStateOf("") }
    var severity by remember { mutableStateOf("MODERATE") } // MILD, MODERATE, DANGEROUS
    var hasPhoto by remember { mutableStateOf(false) }

    val issueTypesList = listOf(
        Pair("POTHOLE", "Hazardous Pothole"),
        Pair("BROKEN_ROAD", "Crumbling / Broken Patch"),
        Pair("WATERLOGGING", "Waterlogged Drainage"),
        Pair("OPEN_MANHOLE", "Open Manhole Cover ⚠️"),
        Pair("UNSAFE_BREAKER", "Illegal Speed Breaker"),
        Pair("ROAD_DUG_UP", "Utility Dig-up Unfilled"),
        Pair("GARBAGE_DEBRIS", "Debris on Carriageway"),
        Pair("MISSING_STREETLIGHT", "Pitch Dark Blackspot"),
        Pair("OTHER", "Other Structural Defect")
    )

    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF12131A),
            Color(0xFF1E2130)
        )
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Report Road Hazard", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { onBack() }) {
                        Icon(imageVector = Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
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
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                // --- ISSUE SELECTOR ---
                Text(
                    text = "SELECT HAZARD CATEGORY",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Gray,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))

                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    issueTypesList.chunked(2).forEach { rowList ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            rowList.forEach { pair ->
                                Card(
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (issueType == pair.first) Color(0xFF1A3311) else Color(0x0CFFFFFF)
                                    ),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(44.dp)
                                        .border(
                                            width = 1.dp,
                                            color = if (issueType == pair.first) Color(0xFF64DD17) else Color.Transparent,
                                            shape = RoundedCornerShape(10.dp)
                                        )
                                        .clickable { issueType = pair.first }
                                ) {
                                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                        Text(
                                            text = pair.second,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (issueType == pair.first) Color(0xFF64DD17) else Color.White,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                            }
                            if (rowList.size == 1) {
                                Box(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // --- SEVERITY SELECTION ---
                Text(
                    text = "SEVERITY CLASS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Gray,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    SeverityButton("MILD", severity == "MILD", Color(0xFF64DD17)) { severity = "MILD" }
                    SeverityButton("MODERATE", severity == "MODERATE", Color(0xFFFFD600)) { severity = "MODERATE" }
                    SeverityButton("DANGEROUS", severity == "DANGEROUS", Color(0xFFD50000)) { severity = "DANGEROUS" }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // --- PHOTO EVIDENCE ATTACHMENT (MOCK) ---
                Text(
                    text = "ATTACH PHOTO EVIDENCE",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Gray,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(130.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x0CFFFFFF))
                        .clickable { hasPhoto = !hasPhoto }
                        .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (hasPhoto) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Filled.CheckCircle,
                                contentDescription = "Photo Attached",
                                tint = Color(0xFF64DD17),
                                modifier = Modifier.size(36.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(text = "pothole_evidence_gps.jpg", color = Color.White, fontSize = 12.sp)
                            Text(text = "Click to remove photo", color = Color.Gray, fontSize = 10.sp)
                        }
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Filled.CameraEnhance,
                                contentDescription = "Camera Icon",
                                tint = Color.LightGray,
                                modifier = Modifier.size(36.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(text = "Simulate Camera Capture", color = Color.White, fontSize = 12.sp)
                            Text(text = "Appends geotagged photo metadata", color = Color.Gray, fontSize = 10.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // --- DESCRIPTION ---
                Text(
                    text = "LOCATION NOTES / LANDMARK",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Gray,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    placeholder = { Text("e.g. Opposite CCD on Linking Road, depth approx 10cm") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF64DD17),
                        unfocusedBorderColor = Color.Gray,
                        focusedLabelColor = Color(0xFF64DD17),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(90.dp)
                        .testTag("hazard_description_field")
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = {
                    viewModel.submitManualReport(
                        type = issueType,
                        description = description,
                        severity = severity
                    )
                    onReportSubmitted()
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64DD17)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("submit_manual_report_button")
            ) {
                Text(text = "Submit Local Report", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun RowScope.SeverityButton(
    text: String,
    isSelected: Boolean,
    accentColor: Color,
    onClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) accentColor.copy(alpha = 0.2f) else Color(0x0CFFFFFF)
        ),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .weight(1f)
            .height(38.dp)
            .border(
                width = 1.dp,
                color = if (isSelected) accentColor else Color.Transparent,
                shape = RoundedCornerShape(8.dp)
            )
            .clickable { onClick() }
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                text = text,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = if (isSelected) accentColor else Color.White
            )
        }
    }
}
