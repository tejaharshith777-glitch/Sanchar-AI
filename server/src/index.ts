import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';
import { connectDB } from './services/db';

dotenv.config({ path: '../.env' }); // try root .env first
if (!process.env.MONGODB_URI) {
  dotenv.config(); // fallback to local .env
}

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

connectDB().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}).catch(console.error);
