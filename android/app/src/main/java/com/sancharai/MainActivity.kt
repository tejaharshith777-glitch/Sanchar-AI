package com.sancharai

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.google.android.gms.location.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.sancharai.data.*
import com.sancharai.receiver.AlarmBroadcastReceiver
import com.sancharai.receiver.GeofenceBroadcastReceiver
import com.sancharai.service.SafeTripService
import com.sancharai.ui.theme.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.*

class MainActivity : ComponentActivity() {

    private lateinit var db: AppDatabase
    private lateinit var cameraExecutor: ExecutorService

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        if (!fineGranted) {
            Toast.makeText(this, "Tracking limited without location permissions", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        db = AppDatabase.getDatabase(this)
        cameraExecutor = Executors.newSingleThreadExecutor()

        requestPermissions()

        setContent {
            SancharAITheme {
                MainNavigation(db, cameraExecutor)
            }
        }
    }

    private fun requestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            permissions.add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(permissions.toTypedArray())
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}

// ─── NAVIGATION ──────────────────────────────────────────────
@Composable
fun MainNavigation(db: AppDatabase, cameraExecutor: ExecutorService) {
    val navController = rememberNavController()
    val activeTrip by db.tripDao().getActiveTrip().collectAsStateWithLifecycle(initialValue = null)

    LaunchedEffect(activeTrip) {
        activeTrip?.let {
            if (it.status == "active") {
                navController.navigate("active/${it.id}") {
                    popUpTo("home") { inclusive = false }
                }
            }
        }
    }

    NavHost(navController = navController, startDestination = "home") {
        composable("home") { HomeScreen(db, navController) }
        composable("active/{tripId}") { backStackEntry ->
            val tripId = backStackEntry.arguments?.getString("tripId")?.toLongOrNull() ?: -1L
            ActiveTripScreen(tripId, db, navController)
        }
        composable("scan/{tripId}") { backStackEntry ->
            val tripId = backStackEntry.arguments?.getString("tripId")?.toLongOrNull() ?: -1L
            ScanExpenseScreen(tripId, db, navController, cameraExecutor)
        }
        composable("expenses/{tripId}") { backStackEntry ->
            val tripId = backStackEntry.arguments?.getString("tripId")?.toLongOrNull() ?: -1L
            ExpensesScreen(tripId, db, navController)
        }
        composable("diary/{tripId}") { backStackEntry ->
            val tripId = backStackEntry.arguments?.getString("tripId")?.toLongOrNull() ?: -1L
            DiaryScreen(tripId, db, navController)
        }
    }
}

// ─── HOME SCREEN ─────────────────────────────────────────────
@Composable
fun HomeScreen(db: AppDatabase, navController: NavController) {
    val context = LocalContext.current
    var origin by remember { mutableStateOf("") }
    var destination by remember { mutableStateOf("") }
    var budget by remember { mutableStateOf("10000") }
    var departureDelayMin by remember { mutableStateOf("") }
    var expectedArrival by remember { mutableStateOf("") }
    var trustedContact by remember { mutableStateOf("") }
    var useGeofence by remember { mutableStateOf(false) }
    var useAlarm by remember { mutableStateOf(false) }

    val cities = listOf(
        "Chennai", "Coimbatore", "Madurai", "Kochi", "Bengaluru",
        "Mumbai", "Pune", "Delhi", "Jaipur", "Kolkata",
        "Bhubaneswar", "Ahmedabad", "Guwahati", "Varanasi"
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgLight)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column(modifier = Modifier.padding(vertical = 16.dp)) {
                Text(
                    text = "Sanchar AI",
                    style = Typography.headlineLarge,
                    color = BrandTeal
                )
                Text(
                    text = "Travel confidently, even offline.",
                    style = Typography.bodyLarge,
                    color = MutedSlate
                )
            }
        }

        // Battery optimization settings block
        item {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoring = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pm.isIgnoringBatteryOptimizations(context.packageName)
            } else true

            Card(
                colors = CardDefaults.cardColors(containerColor = if (isIgnoring) SuccessGreen.copy(0.08f) else AccentSaffron.copy(0.08f)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = if (isIgnoring) Icons.Default.BatteryChargingFull else Icons.Default.BatteryAlert,
                        contentDescription = "Battery optimization status",
                        tint = if (isIgnoring) SuccessGreen else AccentSaffron
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (isIgnoring) "Reliable auto-start ON" else "Auto-start status: Reduced reliability",
                            style = Typography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                            color = InkCharcoal
                        )
                        Text(
                            text = if (isIgnoring) "Sanchar AI runs smoothly in background." else "Tap to disable battery restriction for geofence/alarm.",
                            style = Typography.bodyMedium,
                            color = MutedSlate
                        )
                    }
                    if (!isIgnoring) {
                        IconButton(onClick = {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                    data = Uri.parse("package:${context.packageName}")
                                }
                                context.startActivity(intent)
                            }
                        }) {
                            Icon(Icons.Default.OpenInNew, contentDescription = "Settings", tint = AccentSaffron)
                        }
                    }
                }
            }
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = White),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text("Plan Your Journey", style = Typography.headlineMedium, color = InkCharcoal)

                    // Origin
                    Column {
                        Text("Origin City", style = Typography.bodyMedium, fontWeight = FontWeight.Bold)
                        CityDropdown(cities, origin, "Select Origin") { origin = it }
                    }

                    // Destination
                    Column {
                        Text("Destination City", style = Typography.bodyMedium, fontWeight = FontWeight.Bold)
                        CityDropdown(cities, destination, "Select Destination") { destination = it }
                    }

                    // Budget
                    OutlinedTextField(
                        value = budget,
                        onValueChange = { budget = it },
                        label = { Text("Budget (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Trusted Contact
                    OutlinedTextField(
                        value = trustedContact,
                        onValueChange = { trustedContact = it },
                        label = { Text("Trusted Contact Name") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Departure Alarm setup
                    OutlinedTextField(
                        value = departureDelayMin,
                        onValueChange = { departureDelayMin = it },
                        label = { Text("Delay Departure (minutes)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Options
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Checkbox(checked = useGeofence, onCheckedChange = { useGeofence = it })
                        Text("Enable Home Zone Geofence Start (200m)", modifier = Modifier.align(Alignment.CenterVertically))
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Checkbox(checked = useAlarm, onCheckedChange = { useAlarm = it })
                        Text("Enable Alarm Auto-Start Check", modifier = Modifier.align(Alignment.CenterVertically))
                    }

                    Button(
                        onClick = {
                            if (origin.isEmpty() || destination.isEmpty()) {
                                Toast.makeText(context, "Please choose cities", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            if (origin == destination) {
                                Toast.makeText(context, "Pick a different destination — you're already there! 😄", Toast.LENGTH_LONG).show()
                                return@Button
                            }

                            val budgetVal = budget.toDoubleOrNull() ?: 10000.0
                            val delayMin = departureDelayMin.toLongOrNull() ?: 0L

                            CoroutineScope(Dispatchers.IO).launch {
                                // Create created trip
                                val newTrip = Trip(
                                    originCity = origin,
                                    destinationCity = destination,
                                    budget = budgetVal,
                                    status = if (useGeofence || useAlarm) "created" else "active",
                                    startSource = if (useGeofence || useAlarm) "manual" else "manual"
                                )
                                val tripId = db.tripDao().insertTrip(newTrip)

                                if (useGeofence) {
                                    setupHomeGeofence(context, tripId)
                                }
                                if (useAlarm && delayMin > 0) {
                                    setupAlarmStart(context, tripId, delayMin)
                                }

                                CoroutineScope(Dispatchers.Main).launch {
                                    if (useGeofence || useAlarm) {
                                        Toast.makeText(context, "Trip scheduled! Exit home geofence or wait for departure time.", Toast.LENGTH_LONG).show()
                                    } else {
                                        // Manual launch
                                        val serviceIntent = Intent(context, SafeTripService::class.java).apply {
                                            putExtra(SafeTripService.EXTRA_TRIP_ID, tripId)
                                        }
                                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                            context.startForegroundService(serviceIntent)
                                        } else {
                                            context.startService(serviceIntent)
                                        }
                                        navController.navigate("active/$tripId")
                                    }
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = BrandTeal),
                        shape = RoundedCornerShape(999.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Navigation, contentDescription = "Start")
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Start Journey", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun CityDropdown(cities: List<String>, selected: String, placeholder: String, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxWidth()) {
        OutlinedButton(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp)
        ) {
            Text(if (selected.isEmpty()) placeholder else selected, color = InkCharcoal)
            Spacer(modifier = Modifier.weight(1f))
            Icon(Icons.Default.ArrowDropDown, contentDescription = "Dropdown", tint = MutedSlate)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            cities.forEach { city ->
                DropdownMenuItem(
                    text = { Text(city) },
                    onClick = {
                        onSelect(city)
                        expanded = false
                    }
                )
            }
        }
    }
}

private fun setupHomeGeofence(context: Context, tripId: Long) {
    // In production, register home coordinates as home zone geofence.
    // For validation purpose, we simulate setting a geofence around current location.
    val geofencingClient = LocationServices.getGeofencingClient(context)
    val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    try {
        fusedLocationClient.lastLocation.addOnSuccessListener { location ->
            if (location != null) {
                val geofence = Geofence.Builder()
                    .setRequestId("home_zone_geofence_$tripId")
                    .setCircularRegion(location.latitude, location.longitude, 200f) // 200m zone
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_EXIT)
                    .build()

                val request = GeofencingRequest.Builder().apply {
                    setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_EXIT)
                    addGeofence(geofence)
                }.build()

                val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    tripId.toInt(),
                    intent,
                    PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                geofencingClient.addGeofences(request, pendingIntent)
            }
        }
    } catch (unlikely: SecurityException) {
        Log.e("MainActivity", "Missing geofence permission")
    }
}

private fun setupAlarmStart(context: Context, tripId: Long, delayMinutes: Long) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(context, AlarmBroadcastReceiver::class.java)
    val pendingIntent = PendingIntent.getBroadcast(
        context,
        tripId.toInt(),
        intent,
        PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
    val triggerTime = System.currentTimeMillis() + delayMinutes * 60000L
    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
}

// ─── ACTIVE TRIP SCREEN ──────────────────────────────────────
@Composable
fun ActiveTripScreen(tripId: Long, db: AppDatabase, navController: NavController) {
    val context = LocalContext.current
    val tripFlow = remember(tripId) { db.tripDao().getTripById(tripId) }
    val trip by tripFlow.collectAsStateWithLifecycle(initialValue = null)
    val pointsFlow = remember(tripId) { db.locationPointDao().getPointsForTrip(tripId) }
    val points by pointsFlow.collectAsStateWithLifecycle(initialValue = emptyList())
    val expensesFlow = remember(tripId) { db.expenseDao().getExpensesForTrip(tripId) }
    val expenses by expensesFlow.collectAsStateWithLifecycle(initialValue = emptyList())

    if (trip == null) return

    val currentTrip = trip!!
    var isTrackingPaused by remember { mutableStateOf(currentTrip.status == "paused") }

    // Live calculations
    val totalDistance = remember(points) {
        var dist = 0.0
        for (i in 0 until points.size - 1) {
            val p1 = points[i]
            val p2 = points[i + 1]
            dist += haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng)
        }
        dist
    }
    val speedKmh = points.lastOrNull()?.speedKmh ?: 0.0

    // Probable segment classification
    val (segment, confidence) = when {
        speedKmh < 1.0 -> Pair("still", 92)
        speedKmh < 6.0 -> Pair("walking", 84)
        speedKmh < 70.0 -> Pair("road_vehicle", 76)
        else -> Pair("rail", 71)
    }

    var showArrivalDialog by remember { mutableStateOf(false) }

    // Real stillness arrival check: trip active, stillness sustained (we query location logs showing < 1 km/h for last 5 mins or points count)
    LaunchedEffect(points, currentTrip.status) {
        if (currentTrip.status == "active" && points.size >= 5) {
            val lastFivePoints = points.takeLast(5)
            val allStill = lastFivePoints.all { (it.speedKmh ?: 0.0) < 1.0 }
            if (allStill) {
                showArrivalDialog = true
            }
        }
    }

    Scaffold(
        bottomBar = {
            Surface(
                color = White,
                tonalElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Scan Expense Button
                    Button(
                        onClick = { navController.navigate("scan/$tripId") },
                        colors = ButtonDefaults.buttonColors(containerColor = BrandTeal),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = "Scan")
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Scan Bill")
                    }

                    // Expenses List Button
                    Button(
                        onClick = { navController.navigate("expenses/$tripId") },
                        colors = ButtonDefaults.buttonColors(containerColor = BrandTeal),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.List, contentDescription = "Expenses")
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Expenses")
                    }

                    // SOS Red Button
                    Button(
                        onClick = {
                            // Log SOS event
                            CoroutineScope(Dispatchers.IO).launch {
                                val sosExpense = Expense(
                                    tripId = tripId,
                                    merchant = "Emergency SOS logged",
                                    amount = 0.0,
                                    category = "OTHER",
                                    source = "MANUAL",
                                    confirmed = true
                                )
                                db.expenseDao().insertExpense(sosExpense)
                            }
                            // Dial emergency 112
                            val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                                data = Uri.parse("tel:112")
                            }
                            context.startActivity(dialIntent)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = DangerRed),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = "SOS", tint = White)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("SOS", color = White)
                    }
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(BgLight)
                .padding(innerPadding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${currentTrip.originCity} → ${currentTrip.destinationCity}",
                            style = Typography.headlineMedium,
                            color = InkCharcoal
                        )
                        Text(
                            text = "Live Safe-Trip Active",
                            style = Typography.bodyLarge,
                            color = SuccessGreen,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    // Status Badge
                    Surface(
                        color = SuccessGreen.copy(0.1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "Low-power tracking",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = SuccessGreen,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Stats grid
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            // Speed
                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Live Speed", style = Typography.bodyMedium, color = MutedSlate)
                                Text("${String.format("%.1f", speedKmh)}", style = Typography.headlineLarge, color = BrandTeal)
                                Text("km/h", style = Typography.bodyMedium, color = MutedSlate)
                            }
                            // Distance
                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Distance", style = Typography.bodyMedium, color = MutedSlate)
                                Text("${String.format("%.2f", totalDistance)}", style = Typography.headlineLarge, color = BrandTeal)
                                Text("km", style = Typography.bodyMedium, color = MutedSlate)
                            }
                        }
                    }
                }
            }

            // Segment / Activity Display
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Icon(Icons.Default.DirectionsRun, contentDescription = "Mode", tint = BrandTeal, modifier = Modifier.size(32.dp))
                        Column {
                            Text("Probable Mode Segment", style = Typography.bodyMedium, color = MutedSlate)
                            Text(
                                text = "${segment.replace('_', ' ').uppercase()} ($confidence% confidence)",
                                style = Typography.bodyLarge,
                                fontWeight = FontWeight.Bold,
                                color = InkCharcoal
                            )
                            Text("Probabilistic — you always confirm.", style = Typography.bodyMedium, color = MutedSlate)
                        }
                    }
                }
            }

            // Real Canvas Polyline Track display (Canvas-based)
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Your Private Track", style = Typography.bodyLarge, fontWeight = FontWeight.Bold)
                        Text("Stored only on this device", style = Typography.bodyMedium, color = MutedSlate)
                        Spacer(modifier = Modifier.height(12.dp))

                        Canvas(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .background(BgLight, shape = RoundedCornerShape(12.dp))
                        ) {
                            if (points.isNotEmpty()) {
                                val minLat = points.minOf { it.lat }
                                val maxLat = points.maxOf { it.lat }
                                val minLng = points.minOf { it.lng }
                                val maxLng = points.maxOf { it.lng }

                                val latRange = (maxLat - minLat).coerceAtLeast(0.0001)
                                val lngRange = (maxLng - minLng).coerceAtLeast(0.0001)

                                val coords = points.map { point ->
                                    val x = ((point.lng - minLng) / lngRange * (size.width - 40f) + 20f).toFloat()
                                    val y = ((1.0 - (point.lat - minLat) / latRange) * (size.height - 40f) + 20f).toFloat()
                                    Offset(x, y)
                                }

                                for (i in 0 until coords.size - 1) {
                                    drawLine(
                                        color = BrandTeal,
                                        start = coords[i],
                                        end = coords[i + 1],
                                        strokeWidth = 6f
                                    )
                                }

                                // Draw end dot
                                drawCircle(
                                    color = AccentSaffron,
                                    radius = 8f,
                                    center = coords.last()
                                )
                            }
                        }
                    }
                }
            }

            // Pause / Resume and Stop buttons
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = {
                            isTrackingPaused = !isTrackingPaused
                            val nextStatus = if (isTrackingPaused) "paused" else "active"
                            CoroutineScope(Dispatchers.IO).launch {
                                val currentPauseCount = currentTrip.pauseCount
                                db.tripDao().updateTrip(
                                    currentTrip.copy(
                                        status = nextStatus,
                                        pauseCount = if (isTrackingPaused) currentPauseCount + 1 else currentPauseCount
                                    )
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = AccentSaffron),
                        shape = RoundedCornerShape(999.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(if (isTrackingPaused) Icons.Default.PlayArrow else Icons.Default.Pause, contentDescription = "Pause")
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(if (isTrackingPaused) "Resume" else "Pause")
                    }

                    Button(
                        onClick = {
                            // Finish trip
                            CoroutineScope(Dispatchers.IO).launch {
                                db.tripDao().updateTrip(
                                    currentTrip.copy(
                                        status = "completed",
                                        endTime = System.currentTimeMillis()
                                    )
                                )
                                // Stop foreground service
                                context.stopService(Intent(context, SafeTripService::class.java))
                                CoroutineScope(Dispatchers.Main).launch {
                                    navController.navigate("diary/$tripId")
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = BrandTeal),
                        shape = RoundedCornerShape(999.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = "Finish")
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Finish Trip")
                    }
                }
            }
        }
    }

    if (showArrivalDialog) {
        Dialog(onDismissRequest = { showArrivalDialog = false }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = White),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(24.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Icon(Icons.Default.PinDrop, contentDescription = "Arrival", tint = BrandTeal, modifier = Modifier.size(48.dp))
                    Text(
                        text = "Arrived in ${currentTrip.destinationCity}?",
                        style = Typography.headlineMedium,
                        color = InkCharcoal
                    )
                    Text(
                        text = "It looks like you've reached your destination. Confirm arrival?",
                        style = Typography.bodyMedium,
                        color = MutedSlate
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = {
                                // "Not yet" resets STILL timer
                                CoroutineScope(Dispatchers.IO).launch {
                                    db.tripDao().updateTrip(currentTrip.copy(notYetCount = currentTrip.notYetCount + 1))
                                }
                                showArrivalDialog = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MutedSlate),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Not Yet")
                        }

                        Button(
                            onClick = {
                                // Complete trip
                                CoroutineScope(Dispatchers.IO).launch {
                                    db.tripDao().updateTrip(
                                        currentTrip.copy(
                                            status = "completed",
                                            endTime = System.currentTimeMillis()
                                        )
                                    )
                                    context.stopService(Intent(context, SafeTripService::class.java))
                                    CoroutineScope(Dispatchers.Main).launch {
                                        showArrivalDialog = false
                                        navController.navigate("diary/$tripId")
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Yes, Arrived!")
                        }
                    }
                }
            }
        }
    }
}

// Distance computation utility (Haversine formula in km)
private fun haversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val r = 6371.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c
}

// ─── SCAN EXPENSE SCREEN ─────────────────────────────────────
@Composable
fun ScanExpenseScreen(tripId: Long, db: AppDatabase, navController: NavController, cameraExecutor: ExecutorService) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var ocrStatus by remember { mutableStateOf("Take a photo of a ticket or bill.") }
    var detectedAmount by remember { mutableStateOf<Double?>(null) }
    var merchant by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("TRANSPORT") }
    var rawOcrText by remember { mutableStateOf("") }
    var showDialog by remember { mutableStateOf(false) }

    val imageCapture = remember { ImageCapture.Builder().build() }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            factory = { ctx ->
                PreviewView(ctx).apply {
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()
                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(surfaceProvider)
                        }
                        try {
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageCapture
                            )
                        } catch (e: Exception) {
                            Log.e("Camera", "Binding failed", e)
                        }
                    }, ContextCompat.getMainExecutor(ctx))
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Floating UI Controls
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Surface(
                color = InkCharcoal.copy(0.8f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = ocrStatus,
                    color = White,
                    modifier = Modifier.padding(12.dp),
                    fontSize = 14.sp
                )
            }

            // Capture button
            FloatingActionButton(
                onClick = {
                    ocrStatus = "Capturing & running OCR..."
                    val photoFile = File(context.cacheDir, "ocr_${System.currentTimeMillis()}.jpg")
                    val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                    imageCapture.takePicture(
                        outputOptions,
                        ContextCompat.getMainExecutor(context),
                        object : ImageCapture.OnImageSavedCallback {
                            override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                                runOcr(context, photoFile) { resultText ->
                                    rawOcrText = resultText
                                    // Parse for ₹ or INR amount
                                    val amountMatch = parseOcrAmount(resultText)
                                    detectedAmount = amountMatch
                                    ocrStatus = if (amountMatch != null) "Detected ₹$amountMatch" else "Could not autodetect amount."
                                    showDialog = true
                                }
                            }

                            override fun onError(exception: ImageCaptureException) {
                                ocrStatus = "Error capturing image"
                            }
                        }
                    )
                },
                containerColor = AccentSaffron,
                contentColor = InkCharcoal,
                modifier = Modifier.size(72.dp),
                shape = RoundedCornerShape(999.dp)
            ) {
                Icon(Icons.Default.Camera, contentDescription = "Capture", modifier = Modifier.size(36.dp))
            }
        }
    }

    if (showDialog) {
        Dialog(onDismissRequest = { showDialog = false }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = White),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(24.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text("Confirm Scanned Expense", style = Typography.headlineMedium, color = InkCharcoal)

                    var amountInput by remember { mutableStateOf(detectedAmount?.toString() ?: "") }

                    OutlinedTextField(
                        value = amountInput,
                        onValueChange = { amountInput = it },
                        label = { Text("Amount (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = merchant,
                        onValueChange = { merchant = it },
                        label = { Text("Merchant name") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Category Selector
                    Column {
                        Text("Category", style = Typography.bodyMedium, fontWeight = FontWeight.Bold)
                        val categories = listOf("TRANSPORT", "FOOD", "HOTEL", "OTHER")
                        var expanded by remember { mutableStateOf(false) }
                        Box(modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                                Text(category)
                            }
                            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                                categories.forEach { cat ->
                                    DropdownMenuItem(text = { Text(cat) }, onClick = {
                                        category = cat
                                        expanded = false
                                    })
                                }
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { showDialog = false },
                            colors = ButtonDefaults.buttonColors(containerColor = MutedSlate),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Cancel")
                        }

                        Button(
                            onClick = {
                                val finalAmount = amountInput.toDoubleOrNull() ?: 0.0
                                CoroutineScope(Dispatchers.IO).launch {
                                    val expense = Expense(
                                        tripId = tripId,
                                        merchant = merchant.ifEmpty { "Scanned Receipt" },
                                        amount = finalAmount,
                                        category = category,
                                        source = "OCR",
                                        ocrSnippet = rawOcrText.take(150),
                                        confirmed = true
                                    )
                                    db.expenseDao().insertExpense(expense)
                                }
                                showDialog = false
                                navController.navigate("active/$tripId")
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = BrandTeal),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Save")
                        }
                    }
                }
            }
        }
    }
}

private fun runOcr(context: Context, imageFile: File, onComplete: (String) -> Unit) {
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    val image = InputImage.fromFilePath(context, Uri.fromFile(imageFile))
    recognizer.process(image)
        .addOnSuccessListener { visionText ->
            onComplete(visionText.text)
        }
        .addOnFailureListener {
            onComplete("")
        }
}

private fun parseOcrAmount(text: String): Double? {
    val match = Regex(/(?:Rs\.?|₹|INR)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/i).find(text)
        ?: Regex(/(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:\/-)/i).find(text)
        ?: Regex(/(?:total|fare|amount|price)[:\s]*(\d+(?:,\d+)*(?:\.\d{1,2})?)/i).find(text)

    return match?.groupValues?.get(1)?.replace(",", "")?.toDoubleOrNull()
}

// ─── EXPENSES SCREEN ─────────────────────────────────────────
@Composable
fun ExpensesScreen(tripId: Long, db: AppDatabase, navController: NavController) {
    val tripFlow = remember(tripId) { db.tripDao().getTripById(tripId) }
    val trip by tripFlow.collectAsStateWithLifecycle(initialValue = null)
    val expensesFlow = remember(tripId) { db.expenseDao().getExpensesForTrip(tripId) }
    val expenses by expensesFlow.collectAsStateWithLifecycle(initialValue = emptyList())

    if (trip == null) return

    val currentTrip = trip!!
    val totalSpent = expenses.sumOf { it.amount }
    val remaining = currentTrip.budget - totalSpent

    Scaffold(
        topBar = {
            Surface(color = BrandTeal, contentColor = White) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Text("Trip Expenses", style = Typography.headlineMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text("Budget", fontSize = 12.sp, color = White.copy(0.7f))
                            Text("₹${String.format("%,.0f", currentTrip.budget)}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Column {
                            Text("Spent", fontSize = 12.sp, color = White.copy(0.7f))
                            Text("₹${String.format("%,.0f", totalSpent)}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Column {
                            Text("Remaining", fontSize = 12.sp, color = White.copy(0.7f))
                            Text("₹${String.format("%,.0f", remaining)}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(BgLight)
                .padding(innerPadding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(expenses) { expense ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(expense.merchant, style = Typography.bodyLarge, fontWeight = FontWeight.Bold)
                            Text("${expense.category} · ${expense.source}", style = Typography.bodyMedium, color = MutedSlate)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("₹${String.format("%,.2f", expense.amount)}", style = Typography.bodyLarge, fontWeight = FontWeight.Bold, color = BrandTeal)
                            Spacer(modifier = Modifier.width(8.dp))
                            IconButton(onClick = {
                                CoroutineScope(Dispatchers.IO).launch {
                                    db.expenseDao().deleteExpense(expense)
                                }
                            }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = DangerRed)
                            }
                        }
                    }
                }
            }
            if (expenses.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
                        Text("No expenses logged yet.", color = MutedSlate)
                    }
                }
            }
        }
    }
}

// ─── DIARY SCREEN ────────────────────────────────────────────
@Composable
fun DiaryScreen(tripId: Long, db: AppDatabase, navController: NavController) {
    val context = LocalContext.current
    val tripFlow = remember(tripId) { db.tripDao().getTripById(tripId) }
    val trip by tripFlow.collectAsStateWithLifecycle(initialValue = null)
    val expensesFlow = remember(tripId) { db.expenseDao().getExpensesForTrip(tripId) }
    val expenses by expensesFlow.collectAsStateWithLifecycle(initialValue = emptyList())
    val pointsFlow = remember(tripId) { db.locationPointDao().getPointsForTrip(tripId) }
    val points by pointsFlow.collectAsStateWithLifecycle(initialValue = emptyList())

    if (trip == null) return

    val currentTrip = trip!!
    val totalSpent = expenses.sumOf { it.amount }
    val remaining = currentTrip.budget - totalSpent

    // Calculate real duration
    val durationMin = if (currentTrip.endTime != null) {
        val diffMs = currentTrip.endTime - currentTrip.createdAt
        diffMs / 60000L
    } else 0L

    val totalDistance = remember(points) {
        var dist = 0.0
        for (i in 0 until points.size - 1) {
            dist += haversineDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng)
        }
        dist
    }

    var storyText by remember { mutableStateOf("") }
    LaunchedEffect(currentTrip) {
        storyText = "Left ${currentTrip.originCity} at ${SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(currentTrip.createdAt))}. Travelled ${String.format("%.1f", totalDistance)} km over ${durationMin} minutes. Spent ₹${String.format("%.0f", totalSpent)} of ₹${String.format("%.0f", currentTrip.budget)}. Arrived in ${currentTrip.destinationCity}."
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgLight)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text("Journey Completed!", style = Typography.headlineMedium, color = BrandTeal)
            Text("Your personal travel summary", style = Typography.bodyLarge, color = MutedSlate)
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = White),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Journey Stats", style = Typography.titleLarge, color = InkCharcoal)
                    HorizontalDivider(color = BorderSlate)

                    StatRow("Route", "${currentTrip.originCity} → ${currentTrip.destinationCity}")
                    StatRow("Duration", "$durationMin mins")
                    StatRow("Distance", "${String.format("%.2f", totalDistance)} km")
                    StatRow("Start Source", currentTrip.startSource.uppercase())
                    StatRow("Pause Count", "${currentTrip.pauseCount}")
                    StatRow("Arrival prompts dismissed", "${currentTrip.notYetCount}")
                    StatRow("Expenses Total", "₹${String.format("%,.2f", totalSpent)}")
                    StatRow("Budget Remaining", "₹${String.format("%,.2f", remaining)}")
                }
            }
        }

        // Editable Story Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = White),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Trip Story", style = Typography.titleLarge, color = InkCharcoal)
                    OutlinedTextField(
                        value = storyText,
                        onValueChange = { storyText = it },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 4
                    )
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = {
                        val shareIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TEXT, storyText)
                            type = "text/plain"
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share Trip Story"))
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentSaffron),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Share, contentDescription = "Share", tint = InkCharcoal)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Share Story", color = InkCharcoal)
                }

                Button(
                    onClick = {
                        navController.navigate("home") {
                            popUpTo("home") { inclusive = true }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandTeal),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Plan New Trip")
                }
            }
        }
    }
}

@Composable
fun StatRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = Typography.bodyMedium, color = MutedSlate)
        Text(value, style = Typography.bodyLarge, fontWeight = FontWeight.Bold, color = InkCharcoal)
    }
}
