package com.sancharai.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "expenses")
data class Expense(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tripId: Long,
    val merchant: String,
    val amount: Double,
    val category: String, // TRANSPORT | FOOD | HOTEL | OTHER
    val source: String, // OCR | MANUAL
    val ocrSnippet: String? = null,
    val confirmed: Boolean,
    val createdAt: Long = System.currentTimeMillis()
)
