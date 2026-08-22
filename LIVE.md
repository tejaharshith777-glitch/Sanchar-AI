# Sanchar AI — Live Capabilities

Sanchar AI has been rebuilt from a staged demo into a live, working application. This document honestly outlines what is currently live in this web deployment versus what requires the native Android production module.

## Live in this Web App Today (Working Code)
- **Live Trip State:** Real MongoDB persistence for trips, segments, expenses, and safety events via the Express REST API (`/api/trips`, `/api/expenses`).
- **Real City Packs:** Real curated packs fetched from the database, driving dynamic language translations and hotel information based on user selection.
- **PWA Offline Queue:** IndexedDB caching and mutation queuing. Actions taken while offline are saved locally and synced via an idempotency key when the connection returns.
- **Real GPS Tracking:** Utilizing the HTML5 Geolocation API (`navigator.geolocation.watchPosition`) to calculate live speed, distance, and probabilistic transport segments (Walking, Road Vehicle, Rail) while the tab is open.
- **Real OCR Ticket Scanning:** Using `Tesseract.js` in the browser to extract text from a camera capture and automatically parse Indian Rupee amounts for expense tracking.
- **Privacy Pipeline:** A backend geohashing service (`ngeohash`) that strips the endpoints of journeys and bins locations into aggregated cells.

## Android App (Production Module)
The following features are **Android app modules** and are represented in the web app as architecture/UI placeholders only. The web app clearly badges these features with an "Android app module" warning.

- **Background Tracking:** The web browser suspends Geolocation API intervals when the screen is locked or tab is hidden. The native app uses Android Foreground Services and `WorkManager`.
- **Sensor Fusion (Activity Recognition):** The native app uses the Android Activity Recognition API (accelerometer + gyroscope) for >85% confidence in segment detection, whereas the web app relies purely on GPS speed thresholds.
- **Push Notification Auto-Wake:** The native app wakes up for trusted-contact messages via Firebase Cloud Messaging (FCM).
- **Precise Step Counting:** Relies on the Android hardware step counter sensor.

## Verification
You can verify the live features by opening the Network tab, throttling the connection to "Offline", recording an expense via the OCR scanner, and observing the IndexedDB queue populate and then flush upon reconnecting to the network!
