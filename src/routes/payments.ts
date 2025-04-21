import { Router } from 'express';
import { db } from '../db';
import { payments } from '../db/schema';
import { eq } from 'drizzle-orm';
import { fromNodeHeaders } from 'better-auth/node';
import auth from '../auth';

const router = Router();

// Get payment history
router.get('/history', async (req, res): Promise<any> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const paymentHistory = await db.select()
      .from(payments)
      .where(eq(payments.userId, session.user.id))
      .orderBy(payments.createdAt);

    res.json(paymentHistory);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new payment record
router.post('/', async (req, res): Promise<any> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { amount, currency, status, revenuecatTransactionId } = req.body;

    if (!amount || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [payment] = await db.insert(payments).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      amount,
      currency: currency || 'USD',
      status,
      revenuecatTransactionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 