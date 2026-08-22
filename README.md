# Sanchar AI - Showcase Website

Sanchar AI is a MERN stack application demonstrating an offline AI travel and tourist safety companion. It is designed to showcase how tourists can travel safely, overcome language barriers, manage tickets, and securely store data offline.

## Architecture
- **Client**: React, TypeScript, Vite, Tailwind CSS, Zustand, Recharts.
- **Server**: Node.js, Express, TypeScript.
- **Database**: MongoDB (with an in-memory fallback for the interactive showcase).

## Setup Instructions

### 1. Install Dependencies
In the root directory, run:
```bash
npm run install:all
```

### 2. Environment Variables
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Populate the `MONGODB_URI` if you want to test against a real MongoDB cluster. If `MONGODB_URI` is missing, the application automatically falls back to an in-memory test store.

### 3. Seed Demo Data
To insert the mock city packs and demo mobility data:
```bash
npm run seed
```

### 4. Run Locally
Run the frontend and backend concurrently:
```bash
npm run dev
```

This will start the backend API and the Vite proxy for the frontend. The application will be accessible at `http://localhost:5173`.

## Demo Features
- **Interactive Simulator**: The homepage includes an interactive smartphone simulator simulating the product journey.
- **Offline Simulation**: Simulates an offline journey, queueing expenses and trip state changes locally to sync once the connection is restored.
- **Privacy Dashboard**: A dashboard showing mock aggregated mobility insights without exposing individual routes.

## Testing and Linting
```bash
npm run lint
npm run typecheck
npm run test
```

## Production Build
```bash
npm run build
npm start
```
