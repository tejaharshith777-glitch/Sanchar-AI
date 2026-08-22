package com.sancharai.receiver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import com.sancharai.MainActivity
import com.sancharai.data.AppDatabase
import com.sancharai.data.Trip
import com.sancharai.service.SafeTripService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class GeofenceBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent) ?: return
        if (geofencingEvent.hasError()) {
            Log.e("GeofenceReceiver", "GeofencingEvent error: ${geofencingEvent.errorCode}")
            return
        }

        val geofenceTransition = geofencingEvent.geofenceTransition
        if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_EXIT) {
            Log.d("GeofenceReceiver", "User exited home zone geofence!")
            
            val db = AppDatabase.getDatabase(context)
            CoroutineScope(Dispatchers.IO).launch {
                val activeTrip = db.tripDao().getActiveTripSync()
                if (activeTrip != null && activeTrip.status == "created") {
                    // Update trip to active with startSource = geofence
                    val updatedTrip = activeTrip.copy(
                        status = "active",
                        startSource = "geofence"
                    )
                    db.tripDao().updateTrip(updatedTrip)

                    // Start tracking service
                    val serviceIntent = Intent(context, SafeTripService::class.java).apply {
                        putExtra(SafeTripService.EXTRA_TRIP_ID, updatedTrip.id)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }

                    // Show notification
                    showAutoStartNotification(context, updatedTrip)
                }
            }
        }
    }

    private fun showAutoStartNotification(context: Context, trip: Trip) {
        val channelId = "geofence_auto_start_channel"
        val notificationId = 2001
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Auto-Start Trips",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        val pm = context.packageManager
        val launchIntent = pm.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setContentTitle("Sanchar AI — Safe Trip Auto-Started")
            .setContentText("You left your home zone. Safe tracking is now active for your trip to ${trip.destinationCity}.")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(notificationId, notification)
    }
}
