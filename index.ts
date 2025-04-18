import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import auth from './src/auth';
import creditsRoutes from './src/routes/credits';
import generationRoutes from './src/routes/generation';
import paymentsRoutes from './src/routes/payments';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;


app.use(cors());

// Auth Routes
app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

// Other Routes
app.use('/api/credits', creditsRoutes);
app.use('/api/generation', generationRoutes);
app.use('/api/payments', paymentsRoutes);

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