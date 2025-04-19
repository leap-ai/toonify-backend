import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, creditsTransactions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get user's credit balance
const getBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        creditsBalance: true,
      },
    });

    res.json({ creditsBalance: user?.creditsBalance || 0 });
  } catch (error) {
    next(error);
  }
};

// Get credit transaction history
const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const transactions = await db.select().from(creditsTransactions)
      .where(eq(creditsTransactions.userId, userId))
      .orderBy(creditsTransactions.createdAt);

    res.json(transactions);
  } catch (error) {
    next(error);
  }
};

// Purchase credits (this will be called after successful RevenueCat payment)
const purchaseCredits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { amount } = req.body;
    if (typeof amount !== 'number') {
      res.status(400).json({ error: 'Amount must be a number' });
      return;
    }

    // Implement payment processing logic here
    await db.update(users)
      .set({
        creditsBalance: sql`${users.creditsBalance} + ${amount}`,
      })
      .where(eq(users.id, userId));

    // Record the transaction
    await db.insert(creditsTransactions).values({
      userId,
      amount,
      type: 'purchase',
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

router.get('/balance', authenticateToken, getBalance);
router.get('/history', authenticateToken, getHistory);
router.post('/purchase', authenticateToken, purchaseCredits);

export default router; 