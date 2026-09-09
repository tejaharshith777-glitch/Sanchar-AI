import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRoutes from './routes/api';
import { connectDB, isMemoryFallback, fallbackReason, setMemoryFallback } from './services/db';

mongoose.set('bufferCommands', false);

dotenv.config({ path: '../.env' }); // try root .env first
if (!process.env.MONGODB_URI) {
  dotenv.config(); // fallback to local .env
}

const app = express();
app.set('trust proxy', 1);
const port = parseInt(process.env.PORT || '3000', 10);

app.use(cors({
  origin: (origin, callback) => {
    const envOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const allowed = ['https://sanchar-ai.vercel.app', ...envOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'];
    if (!origin || allowed.includes(origin)) return callback(null, true); // echoes the requester's OWN single origin — the browser-legal form
    return callback(null, false);
  },
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Idempotency-Key'],
  credentials: true,
}));
app.use(express.json());

app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date(), 
    db: isMemoryFallback ? `memory (fallback: ${fallbackReason})` : 'atlas' 
  });
});

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
