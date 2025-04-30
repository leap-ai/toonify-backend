import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import path from 'path';
import auth from './auth';
import creditsRoutes from './routes/credits';
import generationRoutes from './routes/generation';
import paymentsRoutes from './routes/payments';
import userRoutes from './routes/user';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;


app.use(cors());

// Serve static files from the 'public' directory inside 'dist'
app.use(express.static(path.join(__dirname, 'public')));

// Removed static file serving for /uploads
// app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Auth Routes handled by better-auth
app.all('/api/auth/*splat', toNodeHandler(auth));
app.use('/api/payments', paymentsRoutes);

// Middleware for parsing JSON bodies
app.use(express.json());

// API Routes
app.use('/api/credits', creditsRoutes);
app.use('/api/generation', generationRoutes);
app.use('/api/users', userRoutes);

// get my session
app.get("/api/me", async (req: express.Request, res: express.Response): Promise<void> => {
  const session = await auth.api.getSession({
     headers: fromNodeHeaders(req.headers),
   });
  res.json(session);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 