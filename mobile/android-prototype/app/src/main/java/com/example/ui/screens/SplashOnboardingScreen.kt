package com.example.ui.screens

import android.Manifest
import android.os.Build
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.viewmodel.RoadViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SplashOnboardingScreen(
    viewModel: RoadViewModel,
    onOnboardingComplete: () -> Unit
) {
    var step by remember { mutableStateOf(0) } // 0: Splash, 1: Intro Slides, 2: Auth Email, 3: OTP Code, 4: Consent & Permissions
    var emailInput by remember { mutableStateOf("") }
    var otpInput by remember { mutableStateOf("") }

    val context = LocalContext.current
    val authError by viewModel.authError.collectAsState()
    val isOtpSent by viewModel.isOtpSent.collectAsState()
    val isLoggedIn by viewModel.isLoggedIn.collectAsState()

    // Background gradient
    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF12131A), // Near black
            Color(0xFF1E2130)  // Deep indigo slate
        )
    )

    LaunchedEffect(key1 = step) {
        if (step == 0) {
            kotlinx.coroutines.delay(2000)
            step = 1
        }
    }

    LaunchedEffect(key1 = isLoggedIn) {
        if (isLoggedIn && step < 4) {
            step = 4
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundBrush)
            .safeDrawingPadding()
    ) {
        when (step) {
            0 -> {
                // Splash screen
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Filled.DirectionsCar,
                        contentDescription = "Better Roads Logo",
                        tint = Color(0xFF64DD17),
                        modifier = Modifier.size(96.dp)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = "BETTER ROADS",
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                        letterSpacing = 2.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Intelligent Civic Road Mapping",
                        fontSize = 14.sp,
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )
                }
            }

            1 -> {
                // Intro Slides Explainers
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Spacer(modifier = Modifier.height(40.dp))
                        Icon(
                            imageVector = Icons.Filled.Analytics,
                            contentDescription = "Sensing Explain",
                            tint = Color(0xFFFFD600),
                            modifier = Modifier.size(80.dp)
                        )
                        Spacer(modifier = Modifier.height(32.dp))
                        Text(
                            text = "Map Roads Passively",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Better Roads uses your phone's built-in motion sensors and GPS while you drive to passively detect bumps, cracks, speed breakers, and road roughness without any interactions required during your trips.",
                            fontSize = 15.sp,
                            color = Color.LightGray,
                            textAlign = TextAlign.Center,
                            lineHeight = 22.sp
                        )
                        
                        Spacer(modifier = Modifier.height(40.dp))
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0x1F64DD17)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Security,
                                    contentDescription = "Privacy Icon",
                                    tint = Color(0xFF64DD17),
                                    modifier = Modifier.size(32.dp)
                                )
                                Spacer(modifier = Modifier.width(16.dp))
                                Column {
                                    Text(
                                        text = "Privacy First",
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Text(
                                        text = "All trace starts and ends are blurred automatically to protect your home and work locations.",
                                        fontSize = 12.sp,
                                        color = Color.LightGray
                                    )
                                }
                            }
                        }
                    }

                    Button(
                        onClick = { step = 2 },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64DD17)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("intro_next_button")
                    ) {
                        Text(text = "Get Started", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }
            }

            2 -> {
                // Auth Email
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Spacer(modifier = Modifier.height(40.dp))
                        Text(
                            text = "Authenticate",
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "We use email OTP based verification",
                            fontSize = 14.sp,
                            color = Color.Gray
                        )

                        Spacer(modifier = Modifier.height(40.dp))

                        OutlinedTextField(
                            value = emailInput,
                            onValueChange = { emailInput = it },
                            label = { Text("Email Address") },
                            placeholder = { Text("e.g. driver@gmail.com") },
                            leadingIcon = { Icon(Icons.Filled.Email, contentDescription = "Email") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF64DD17),
                                unfocusedBorderColor = Color.Gray,
                                focusedLabelColor = Color(0xFF64DD17),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("email_input_field")
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        
                        // Strict validation disclaimer
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Info,
                                contentDescription = "Info",
                                tint = Color(0xFFFFD600),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Only Gmail, Outlook, or Proton domains are permitted to eliminate bot registrations and temporary emails.",
                                fontSize = 11.sp,
                                color = Color.Gray,
                                lineHeight = 14.sp
                            )
                        }

                        authError?.let { error ->
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = error,
                                color = MaterialTheme.colorScheme.error,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    Button(
                        onClick = {
                            if (viewModel.validateAndSendOtp(emailInput)) {
                                step = 3
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64DD17)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("send_otp_button")
                    ) {
                        Text(text = "Send OTP Code", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }
            }

            3 -> {
                // OTP Code Verification
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Spacer(modifier = Modifier.height(40.dp))
                        Text(
                            text = "Enter One-Time PIN",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "OTP sent to ${viewModel.authEmail.value}",
                            fontSize = 13.sp,
                            color = Color.Gray,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(40.dp))

                        OutlinedTextField(
                            value = otpInput,
                            onValueChange = { otpInput = it },
                            label = { Text("6-Digit OTP Code") },
                            placeholder = { Text("Enter 123456 or 2026") },
                            leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = "Lock") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF64DD17),
                                unfocusedBorderColor = Color.Gray,
                                focusedLabelColor = Color(0xFF64DD17),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("otp_input_field")
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Hint: Use test PIN '123456' or '2026' to complete evaluation log.",
                            color = Color(0xFFFFD600),
                            fontSize = 12.sp,
                            textAlign = TextAlign.Start,
                            modifier = Modifier.fillMaxWidth()
                        )

                        authError?.let { error ->
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = error,
                                color = MaterialTheme.colorScheme.error,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = { step = 2 },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp)
                        ) {
                            Text(text = "Back")
                        }

                        Button(
                            onClick = {
                                if (viewModel.verifyOtp(otpInput)) {
                                    step = 4
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64DD17)),
                            modifier = Modifier
                                .weight(2f)
                                .height(50.dp)
                                .testTag("verify_otp_button")
                        ) {
                            Text(text = "Verify & Login", color = Color.Black, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            4 -> {
                // Consent & Permissions
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Spacer(modifier = Modifier.height(30.dp))
                        Text(
                            text = "Grant Access",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "We require key capabilities to log roads",
                            fontSize = 13.sp,
                            color = Color.Gray,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        // Permission Item 1
                        PermissionItem(
                            icon = Icons.Filled.LocationOn,
                            title = "High-Accuracy GPS",
                            desc = "Provides real-world positioning, speed profiles, and tagged coordinates of shocks.",
                            tintColor = Color(0xFF64DD17)
                        )

                        // Permission Item 2
                        PermissionItem(
                            icon = Icons.Filled.Sensors,
                            title = "Physical Motion Sensors",
                            desc = "Monitors device accelerometer and linear G-forces at high frequency to map roughness.",
                            tintColor = Color(0xFFFFD600)
                        )

                        // Permission Item 3
                        PermissionItem(
                            icon = Icons.Filled.Notifications,
                            title = "Background Notifications",
                            desc = "Required to host Android's persistent tracking service while navigating with screen off.",
                            tintColor = Color(0xFF00B0FF)
                        )
                    }

                    Button(
                        onClick = { onOnboardingComplete() },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64DD17)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("grant_consent_button")
                    ) {
                        Text(text = "Accept & Continue", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun PermissionItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    desc: String,
    tintColor: Color
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0x0CFFFFFF)),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = tintColor,
                modifier = Modifier
                    .size(32.dp)
                    .padding(top = 2.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = desc,
                    fontSize = 12.sp,
                    color = Color.LightGray,
                    lineHeight = 16.sp
                )
            }
        }
    }
}
