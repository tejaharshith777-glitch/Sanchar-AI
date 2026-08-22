package com.sancharai.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.sancharai.data.AppDatabase
import com.sancharai.data.LocationPoint
import com.sancharai.data.Trip
import kotlinx.coroutines.*
import kotlin.math.*

class SafeTripService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var activeTripId: Long = -1L
    private var lastLocation: Location? = null
    private var db: AppDatabase? = null

    companion object {
        private const val TAG = "SafeTripService"
        private const val CHANNEL_ID = "safe_trip_channel"
        private const val NOTIFICATION_ID = 1001
        const val EXTRA_TRIP_ID = "extra_trip_id"
    }

    override fun onCreate() {
        super.onCreate()
        db = AppDatabase.getDatabase(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    handleNewLocation(location)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val tripId = intent?.getLongExtra(EXTRA_TRIP_ID, -1L) ?: -1L
        if (tripId != -1L) {
            activeTripId = tripId
            startForegroundService()
            requestLocationUpdates()
        } else {
            stopSelf()
        }
        return START_STICKY
    }

    private fun startForegroundService() {
        val notification = buildNotification(0.0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(speedKmh: Double): Notification {
        // Safe intent opening MainActivity
        val pm = packageManager
        val launchIntent = pm.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sanchar AI — Safe Trip active")
            .setContentText("Current speed: ${String.format("%.1f", speedKmh)} km/h")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(speedKmh: Double) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, buildNotification(speedKmh))
    }

    private fun requestLocationUpdates() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            5000L
        ).apply {
            setMinUpdateIntervalMillis(2000L)
        }.build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (unlikely: SecurityException) {
            Log.e(TAG, "Lost location permission. Could not request updates. $unlikely")
        }
    }

    private fun handleNewLocation(location: Location) {
        serviceScope.launch {
            // Speed calculation fallback
            val speedKmh = if (location.hasSpeed()) {
                location.speed * 3.6
            } else {
                lastLocation?.let { last ->
                    val distance = haversine(last.latitude, last.longitude, location.latitude, location.longitude) // in km
                    val timeDiffHrs = (location.time - last.time) / 3600000.0
                    if (timeDiffHrs > 0) distance / timeDiffHrs else 0.0
                } ?: 0.0
            }

            // Save to Room DB
            val point = LocationPoint(
                tripId = activeTripId,
                lat = location.latitude,
                lng = location.longitude,
                accuracyM = location.accuracy,
                speedKmh = speedKmh,
                bearingDeg = location.bearing,
                timestamp = location.time,
                isPaused = false
            )

            db?.locationPointDao()?.insertLocationPoint(point)
            lastLocation = location

            // Update UI/Notification
            updateNotification(speedKmh)
        }
    }

    // Haversine formula to compute distance in km
    private fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Safe Trip Tracking Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        serviceScope.cancel()
        Log.d(TAG, "SafeTripService stopped successfully")
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
