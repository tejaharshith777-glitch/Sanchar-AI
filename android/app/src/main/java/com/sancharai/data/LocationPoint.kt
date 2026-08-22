package com.sancharai.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "location_points")
data class LocationPoint(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tripId: Long,
    val lat: Double,
    val lng: Double,
    val accuracyM: Float,
    val speedKmh: Double?,
    val bearingDeg: Float,
    val timestamp: Long = System.currentTimeMillis(),
    val isPaused: Boolean = false
)
