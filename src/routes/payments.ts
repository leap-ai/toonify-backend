import { Router } from 'express';
import { db } from '../db';
import { payments } from '../../drizzle/schema';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Get available credit packages
router.get('/products', async (req, res) => {
  try {
    // These should match your RevenueCat product IDs
    const products = [
      {
        id: 'credits_10',
        name: '10 Credits',
        credits: 10,
        price: 4.99,
        currency: 'USD',
      },
      {
        id: 'credits_50',
        name: '50 Credits',
        credits: 50,
        price: 19.99,
        currency: 'USD',
      },
      {
        id: 'credits_100',
        name: '100 Credits',
        credits: 100,
        price: 34.99,
        currency: 'USD',
      },
    ];

    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// RevenueCat webhook handler
router.post('/webhook', async (req, res) => {
  try {
    const { event } = req.body;

    // Verify webhook signature (implementation depends on RevenueCat's webhook security)
    // const signature = req.headers['x-revenuecat-signature'];
    // if (!verifySignature(signature, req.body)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        // Record the payment
        await db.insert(payments).values({
          userId: event.user_id,
          amount: event.price,
          currency: event.currency,
          status: 'completed',
          revenuecatTransactionId: event.transaction_id,
        });

        // Credit purchase will be handled by the credits/purchase endpoint
        break;

      case 'CANCELLATION':
        // Handle subscription cancellation if needed
        break;

      case 'BILLING_ISSUE':
        // Handle billing issues
        break;
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ error: 'Error processing webhook' });
  }
});

export default router; 