import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, creditsTransactions } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Get user's credit balance
router.get('/balance', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        creditsBalance: true,
      },
    });

    return res.json({ creditsBalance: user?.creditsBalance || 0 });
  } catch (error) {
    next(error);
  }
});

// Get credit transaction history
router.get('/history', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const creditHistory = await db.query.creditHistory.findMany({
      where: eq(creditHistory.userId, userId),
      orderBy: (creditHistory, { desc }) => [desc(creditHistory.createdAt)],
    });

    return res.json(creditHistory);
  } catch (error) {
    next(error);
  }
});

// Purchase credits (this will be called after successful RevenueCat payment)
router.post('/purchase', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, paymentMethod } = req.body;
    // Implement payment processing logic here

    await db.update(users)
      .set({
        creditsBalance: users.creditsBalance + amount,
      })
      .where(eq(users.id, userId));

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router; 