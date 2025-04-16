import { Router } from 'express';
import { db } from '../db';
import { users, cartoonGenerations, creditsTransactions } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import * as fal from '@fal-ai/serverless-client';

const router = Router();
fal.config({
  credentials: process.env.FAL_KEY,
});

const CREDITS_PER_GENERATION = 1;

// Generate cartoon image
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { imageUrl } = req.body;

    // Check if user has enough credits
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id),
      columns: {
        creditsBalance: true,
      },
    });

    if (!user || user.creditsBalance < CREDITS_PER_GENERATION) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Start a transaction
    const result = await db.transaction(async (tx) => {
      // Deduct credits
      const [updatedUser] = await tx
        .update(users)
        .set({
          creditsBalance: users.creditsBalance - CREDITS_PER_GENERATION,
        })
        .where(eq(users.id, req.user!.id))
        .returning();

      // Record credit usage
      await tx.insert(creditsTransactions).values({
        userId: req.user!.id,
        amount: -CREDITS_PER_GENERATION,
        type: 'usage',
      });

      // Create generation record
      const [generation] = await tx
        .insert(cartoonGenerations)
        .values({
          userId: req.user!.id,
          originalImageUrl: imageUrl,
          generatedImageUrl: '', // Will be updated after generation
          status: 'pending',
          creditsUsed: CREDITS_PER_GENERATION,
        })
        .returning();

      return { user: updatedUser, generation };
    });

    // Generate cartoon image using Fal.ai
    const response = await fal.subscribe('fal-ai/cartoonify', {
      input: {
        image_url: imageUrl,
      },
    });

    // Update generation record with result
    await db
      .update(cartoonGenerations)
      .set({
        generatedImageUrl: response.image_url,
        status: 'completed',
      })
      .where(eq(cartoonGenerations.id, result.generation.id));

    res.json({
      ...result,
      generatedImageUrl: response.image_url,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error generating cartoon image' });
  }
});

// Get generation history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const generations = await db.query.cartoonGenerations.findMany({
      where: eq(cartoonGenerations.userId, req.user!.id),
      orderBy: (generations, { desc }) => [desc(generations.createdAt)],
    });

    res.json({ generations });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching generation history' });
  }
});

export default router; 