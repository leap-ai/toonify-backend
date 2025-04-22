import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { user, creditsTransactions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { fromNodeHeaders } from 'better-auth/node';
import auth from '../auth';

const router = Router();

// Get user's credit balance
const getBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userVal = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: {
        creditsBalance: true,
      },
    });

    res.json({ creditsBalance: userVal?.creditsBalance || 0 });
  } catch (error) {
    next(error);
  }
};

// Get credit transaction history
const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const transactions = await db.select().from(creditsTransactions)
      .where(eq(creditsTransactions.userId, session.user.id))
      .orderBy(creditsTransactions.createdAt);

    res.json(transactions);
  } catch (error) {
    next(error);
  }
};

// Purchase credits (this will be called after successful RevenueCat payment)
const purchaseCredits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { amount, transactionId, productId } = req.body;
    
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    // Check if this transaction has already been processed
    if (transactionId) {
      const existingTransaction = await db.query.creditsTransactions.findFirst({
        where: eq(creditsTransactions.transactionId, transactionId),
      });

      if (existingTransaction) {
        // Transaction already processed, return success
        res.json(existingTransaction);
        return;
      }
    }

    // Create transaction record
    const [transaction] = await db.insert(creditsTransactions).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      amount,
      type: 'purchase',
      paymentId: transactionId || null,
      transactionId: transactionId || null,
      productId: productId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Update user's credit balance
    await db.update(user)
      .set({ creditsBalance: sql`${user.creditsBalance} + ${amount}` })
      .where(eq(user.id, session.user.id));

    res.json(transaction);
  } catch (error) {
    next(error);
  }
};

// Add credits (admin only)
const addCredits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    // Create transaction record
    const [transaction] = await db.insert(creditsTransactions).values({
      id: crypto.randomUUID(),
      userId,
      amount,
      type: 'admin_add',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Update user's credit balance
    await db.update(user)
      .set({ creditsBalance: sql`${user.creditsBalance} + ${amount}` })
      .where(eq(user.id, userId));

    res.json(transaction);
  } catch (error) {
    next(error);
  }
};

router.get('/balance', getBalance);
router.get('/history', getHistory);
router.post('/purchase', purchaseCredits);
router.post('/add', addCredits);

export default router; 