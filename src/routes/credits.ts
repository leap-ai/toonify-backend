import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, creditsTransactions } from '../db/schema';
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

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
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

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    // Create transaction record
    const [transaction] = await db.insert(creditsTransactions).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      amount,
      type: 'purchase',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Update user's credit balance
    await db.update(users)
      .set({ creditsBalance: sql`${users.creditsBalance} + ${amount}` })
      .where(eq(users.id, session.user.id));

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
    await db.update(users)
      .set({ creditsBalance: sql`${users.creditsBalance} + ${amount}` })
      .where(eq(users.id, userId));

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