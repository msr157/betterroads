package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.itemsIndexed
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
fun LeaderboardScreen(
    viewModel: RoadViewModel
) {
    val userProfile by viewModel.userProfile.collectAsState()
    val totalDonations by viewModel.totalContributionsDonated.collectAsState()

    var leaderboardTab by remember { mutableStateOf("CITY") } // CITY, DISTRICT, NATIONAL
    var showDonateDialog by remember { mutableStateOf(false) }

    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF12131A),
            Color(0xFF1B1B26)
        )
    )

    val listItems = when (leaderboardTab) {
        "CITY" -> listOf(
            LeaderboardEntry("Aniket Sharma", "H-West (Bandra)", 1420),
            LeaderboardEntry("Priya Patel", "K-West (Andheri)", 1250),
            LeaderboardEntry("Vikram Malhotra", "G-South (Worli)", 980),
            LeaderboardEntry("Rage Mayank (You)", "H-West (Bandra)", 890 + totalDonations / 10),
            LeaderboardEntry("Neha Sen", "F-North (Sion)", 810)
        )
        "DISTRICT" -> listOf(
            LeaderboardEntry("Mumbai Suburban", "Zone 3", 14500),
            LeaderboardEntry("Mumbai City", "Zone 1", 12300),
            LeaderboardEntry("Thane", "Zone 5", 9800),
            LeaderboardEntry("Navi Mumbai", "Zone 4", 8100)
        )
        else -> listOf(
            LeaderboardEntry("Mumbai Metropolitan", "Maharashtra", 36600),
            LeaderboardEntry("Bengaluru Urban", "Karnataka", 34100),
            LeaderboardEntry("Delhi NCR", "Delhi", 29800),
            LeaderboardEntry("Chennai Corp", "Tamil Nadu", 25200)
        )
    }

    val badgesList = listOf(
        BadgeItem("Pothole Hunter", "Map 5+ potholes in Mumbai", "💥", true),
        BadgeItem("Mumbai Pilot", "Scanned over 10 km", "✈️", true),
        BadgeItem("Road Guardian", "Accumulate 3 active streak days", "🛡️", true),
        BadgeItem("Patron Supporter", "Contributed monetary funds", "🎖️", totalDonations > 12500),
        BadgeItem("Wards Champion", "Sync data from 3 distinct wards", "🏆", false),
        BadgeItem("Civic Pioneer", "First synced sensor trip log", "🌟", true)
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundBrush)
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        // --- Header & Rank Overview ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "PILOT LEADERBOARD",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )
                Text(
                    text = "Gamified community rewards and badges",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }

            Button(
                onClick = { showDonateDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFD600)),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .height(36.dp)
                    .testTag("donate_menu_button")
            ) {
                Text("Support ₹", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // --- Gamified Scopes Selector ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0x0CFFFFFF))
                .padding(4.dp)
        ) {
            ScopeTabButton("CITY LEVEL", leaderboardTab == "CITY", Modifier.weight(1f)) { leaderboardTab = "CITY" }
            ScopeTabButton("DISTRICT LEVEL", leaderboardTab == "DISTRICT", Modifier.weight(1.1f)) { leaderboardTab = "DISTRICT" }
            ScopeTabButton("NATIONAL LEVEL", leaderboardTab == "NATIONAL", Modifier.weight(1.1f)) { leaderboardTab = "NATIONAL" }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // --- Leaderboard Ranking Column ---
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                listItems.forEachIndexed { idx, entry ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Position circle
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .background(
                                    color = when (idx) {
                                        0 -> Color(0xFFFFD600) // Gold
                                        1 -> Color(0xFFB0BEC5) // Silver
                                        2 -> Color(0xFFFFAB91) // Bronze
                                        else -> Color(0x1FFFFFFF)
                                    },
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = (idx + 1).toString(),
                                fontWeight = FontWeight.Bold,
                                color = if (idx < 3) Color.Black else Color.White,
                                fontSize = 13.sp
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = entry.name,
                                fontWeight = FontWeight.Bold,
                                color = if (entry.name.contains("You")) Color(0xFF64DD17) else Color.White,
                                fontSize = 14.sp
                            )
                            Text(text = entry.subtitle, fontSize = 11.sp, color = Color.Gray)
                        }

                        Text(
                            text = "${entry.score} pts",
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            fontSize = 14.sp
                        )
                    }

                    if (idx < listItems.lastIndex) {
                        Divider(color = Color(0x0FFFFFFF))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Badges & Rewards Grid ---
        Text(
            text = "YOUR UNLOCKED BADGES",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Gray,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(10.dp))

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            badgesList.chunked(2).forEach { rowList ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    rowList.forEach { badge ->
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = if (badge.isUnlocked) Color(0x1F64DD17) else Color(0x08FFFFFF)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(90.dp)
                                .border(
                                    width = 1.dp,
                                    color = if (badge.isUnlocked) Color(0xFF64DD17) else Color.Transparent,
                                    shape = RoundedCornerShape(12.dp)
                                )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = if (badge.isUnlocked) badge.emoji else "🔒",
                                    fontSize = 24.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = badge.title,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (badge.isUnlocked) Color.White else Color.Gray,
                                    textAlign = TextAlign.Center
                                )
                                Text(
                                    text = badge.desc,
                                    fontSize = 8.sp,
                                    color = Color.Gray,
                                    textAlign = TextAlign.Center,
                                    lineHeight = 10.sp
                                )
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(30.dp))
    }

    // --- Simulated Monetary Donation Dialog ---
    if (showDonateDialog) {
        AlertDialog(
            onDismissRequest = { showDonateDialog = false },
            title = { Text("Infrastructure Donation", color = Color.White) },
            text = {
                Column {
                    Text(
                        text = "We incentivize civic mapping through physical rewards. Monthly top contributors and supporters of each ward receive free rewards (sensor mounts, badges, and fuel vouchers).",
                        fontSize = 12.sp,
                        color = Color.LightGray
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Select a contribution amount to boost research and mapping in Mumbai's underserved wards:",
                        fontSize = 12.sp,
                        color = Color.LightGray
                    )
                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        DonateOptionButton("₹ 500", Modifier.weight(1f)) {
                            viewModel.contributeDonation(500)
                            showDonateDialog = false
                        }
                        DonateOptionButton("₹ 1,000", Modifier.weight(1f)) {
                            viewModel.contributeDonation(1000)
                            showDonateDialog = false
                        }
                        DonateOptionButton("₹ 2,500", Modifier.weight(1f)) {
                            viewModel.contributeDonation(2500)
                            showDonateDialog = false
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showDonateDialog = false }) { Text("Cancel", color = Color.White) }
            },
            containerColor = Color(0xFF1E2130)
        )
    }
}

@Composable
fun ScopeTabButton(
    text: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (isSelected) Color(0xFF64DD17) else Color.Transparent)
            .clickable { onClick() }
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = if (isSelected) Color.Black else Color.White
        )
    }
}

@Composable
fun DonateOptionButton(
    text: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = Color(0x1F64DD17)),
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
            .border(1.dp, Color(0xFF64DD17), RoundedCornerShape(10.dp))
            .height(44.dp)
    ) {
        Text(text = text, color = Color(0xFF64DD17), fontWeight = FontWeight.Bold, fontSize = 12.sp)
    }
}

data class LeaderboardEntry(val name: String, val subtitle: String, val score: Int)
data class BadgeItem(val title: String, val desc: String, val emoji: String, val isUnlocked: Boolean)
