import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRoutes from './routes/api';
import { connectDB, isMemoryFallback, setMemoryFallback } from './services/db';

mongoose.set('bufferCommands', false);

dotenv.config({ path: '../.env' }); // try root .env first
if (!process.env.MONGODB_URI) {
  dotenv.config(); // fallback to local .env
}

const app = express();
app.set('trust proxy', 1);
const port = parseInt(process.env.PORT || '3000', 10);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  if (origin) {
    // Echo the caller's origin so credentialed requests work; NEVER combine
    // Access-Control-Allow-Origin:* with Allow-Credentials (browsers reject it).
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});
app.use(express.json());

app.use('/api', apiRoutes);
// NOTE: GET /api/health is served by the router (routes/api.ts) — do not
// re-register it here; the duplicate was dead code with a different shape.

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
  if (!isMemoryFallback) {
    setMemoryFallback(`Uncaught Exception: ${err.message || String(err)}`);
  }
});

process.on('unhandledRejection', (reason: any) => {
  console.error('CRITICAL: Unhandled Rejection:', reason);
  if (!isMemoryFallback) {
    setMemoryFallback(`Unhandled Rejection: ${reason?.message || String(reason)}`);
  }
});

connectDB().catch((err) => {
  console.error('connectDB failed unexpectedly:', err);
  setMemoryFallback(err.message || String(err));
}).finally(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
});
