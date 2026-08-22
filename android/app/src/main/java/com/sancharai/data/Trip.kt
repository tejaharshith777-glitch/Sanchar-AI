package com.sancharai.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "trips")
data class Trip(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val originCity: String,
    val destinationCity: String,
    val budget: Double,
    val status: String, // created | active | paused | completed
    val startSource: String, // geofence | alarm | manual
    val createdAt: Long = System.currentTimeMillis(),
    val endTime: Long? = null,
    val pauseCount: Int = 0,
    val notYetCount: Int = 0
)
