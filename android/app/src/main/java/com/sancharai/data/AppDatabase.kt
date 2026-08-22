package com.sancharai.data

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface TripDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrip(trip: Trip): Long

    @Update
    suspend fun updateTrip(trip: Trip)

    @Delete
    suspend fun deleteTrip(trip: Trip)

    @Query("SELECT * FROM trips WHERE id = :id")
    fun getTripById(id: Long): Flow<Trip?>

    @Query("SELECT * FROM trips WHERE id = :id")
    suspend fun getTripByIdSync(id: Long): Trip?

    @Query("SELECT * FROM trips WHERE status = 'active' LIMIT 1")
    fun getActiveTrip(): Flow<Trip?>

    @Query("SELECT * FROM trips WHERE status = 'active' LIMIT 1")
    suspend fun getActiveTripSync(): Trip?

    @Query("SELECT * FROM trips ORDER BY createdAt DESC")
    fun getAllTrips(): Flow<List<Trip>>
}

@Dao
interface ExpenseDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: Expense): Long

    @Update
    suspend fun updateExpense(expense: Expense)

    @Delete
    suspend fun deleteExpense(expense: Expense)

    @Query("SELECT * FROM expenses WHERE tripId = :tripId ORDER BY createdAt DESC")
    fun getExpensesForTrip(tripId: Long): Flow<List<Expense>>

    @Query("SELECT * FROM expenses WHERE tripId = :tripId ORDER BY createdAt DESC")
    suspend fun getExpensesForTripSync(tripId: Long): List<Expense>
}

@Dao
interface LocationPointDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLocationPoint(point: LocationPoint): Long

    @Query("SELECT * FROM location_points WHERE tripId = :tripId ORDER BY timestamp ASC")
    fun getPointsForTrip(tripId: Long): Flow<List<LocationPoint>>

    @Query("SELECT * FROM location_points WHERE tripId = :tripId ORDER BY timestamp ASC")
    suspend fun getPointsForTripSync(tripId: Long): List<LocationPoint>
}

@Database(entities = [Trip::class, Expense::class, LocationPoint::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun tripDao(): TripDao
    abstract fun expenseDao(): ExpenseDao
    abstract fun locationPointDao(): LocationPointDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "sanchar_ai_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
