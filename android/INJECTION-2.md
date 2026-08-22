# Sanchar AI — Android App Feature Status (INJECTION 2)

Sanchar AI's native Android implementation is built using **Kotlin**, **Jetpack Compose**, and **Room DB** under the `android/` directory. It implements a complete offline travel companion with real-time GPS tracking, camera OCR, geofencing, and activity-recognition-based arrival triggers.

---

## 🛠️ Technology Stack & Dependencies

All dependencies are **free, open-source, and run fully on-device without any API keys or internet requirements**:
- **Room Database (`2.6.1`)**: Local persistence for journeys, coordinates, and expenses.
- **Jetpack Compose**: Modern declarative UI with the Sanchar AI teal-and-saffron theme.
- **Fused Location Provider (`2.1.0`)**: Real GPS + Cell low-power tracking.
- **Play Services Activity Recognition**: Direct access to `ACTIVITY_STILL` signals for stillness detection.
- **ML Kit Text Recognition (`16.0.0`)**: Local on-device OCR engine.
- **CameraX (`1.3.1`)**: Hardware camera access for bill/ticket scanning.

---

## 📦 What is Real Now (Implemented Features)

### 1. Database Schema (Room)
- `Trip` Entity: Stores origin, destination, budget, trip status, start source, start time, pause counts, and arrival dialog rejection counts.
- `LocationPoint` Entity: Logged every 5s during active journeys. Captures latitude, longitude, accuracy (meters), speed (km/h), and timestamp.
- `Expense` Entity: Captures amount, category (TRANSPORT, FOOD, HOTEL, OTHER), scanning source (OCR / MANUAL), and raw OCR text snippets.

### 2. Live GPS Tracking & SafeTripService
- Runs as a **Foreground Service` with `SafeTripService` to ensure tracking continues while the screen is locked or the app is in the background.
- Keeps a persistent system notification showing the live speed in km/h.
- Employs balanced-power location requests (5s interval, 2s fastest update) to optimize battery consumption.
- Dynamically computes speed (Haversine formula over delta-time) if the provider returns null.

### 3. Geofence & Alarm Auto-Start (Honest Step 1)
- **Home Zone Geofence**: Automatically wakes the app and transitions the trip to active state with `startSource = "geofence"` when the device exits a 200m circular geofence around the home coordinate.
- **Departure Alarm**: Sets an exact RTC wake-up alarm. When triggered, checks if the user is in motion (>100m or speed detected) to auto-start the tracking service, or prompts the user with a notification.

### 4. Smart Scanner (CameraX + ML Kit OCR)
- Opens a live camera preview, captures high-resolution receipt images, and processes them with Google ML Kit Latin Text Recognition locally on-device.
- Extracts amounts using robust regex patterns (matching ₹, INR, Rs., and currency formats).
- Users verify and edit the merchant, amount, and category before saving.

### 5. Stillness-Based Arrival Detection
- Combines GPS telemetry with Play Services activity recognition.
- If the trip is active, speed is < 1 km/h, and stillness is sustained for 10 minutes, the app presents an arrival dialog.
- Clicking "Not yet" resets the stillness timer and increments the trip's `notYetCount` (visible in the final diary).
- Confirming arrival automatically stops the tracking service cleanly, sets `endTime`, and opens the diary.

### 6. Personal Trip Diary
- Computes stats dynamically from the Room database: duration, distance, start source, pause count, arrival prompts dismissed, expenses total, and budget remaining.
- Generates a custom, editable journey story card.
- Shares the story card via standard Android `ACTION_SEND` Intent.

---

## 🔮 What Injection 3 Adds

In the next phase, **Injection 3** will introduce:
- **Intelligent Transportation Mode Detection**: Deep sensor-fusion using accelerometer signals to distinguish between walking, road vehicle (bus/auto), and rail (train) with a confidence percentage, and allow manual corrections.
- **Advanced Route Deviation Alerts**: A local routing pipeline triggering safety notifications if the user deviates from the expected transport path.
- **On-Device Geohash Privacy Aggregation**: Pre-processing mobility aggregate grids locally before synchronization.
