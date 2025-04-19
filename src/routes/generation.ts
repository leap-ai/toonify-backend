import { Router } from 'express';
import { generateCartoonImage, uploadImageToFal } from '../services/imageGeneration';
import { db } from '../db';
import { generations, users } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';

const router = Router();
const upload = multer();

router.post('/generate', authenticateToken, upload.single('image'), async (req, res): Promise<any> => {
  try {
    console.log(">>>>> I am here")
    const file = req.file;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Check user credits
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.creditsBalance <= 0) {
      return res.status(403).json({ error: 'Insufficient credits' });
    }

    // Convert buffer to base64
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    // Upload image to fal.ai storage
    const falImageUrl = await uploadImageToFal(base64Image);
    console.log('Image uploaded to fal.ai:', falImageUrl);

    // Generate cartoon image
    const cartoonImageUrl = await generateCartoonImage(falImageUrl);
    console.log('Cartoon image generated:', cartoonImageUrl);

    // Save generation to database
    const [generation] = await db.insert(generations).values({
      userId,
      originalImageUrl: falImageUrl,
      cartoonImageUrl: cartoonImageUrl,
      createdAt: new Date(),
      status: 'completed',
      creditsUsed: 1
    }).returning();

    // Deduct credits
    await db.update(users)
      .set({ creditsBalance: user.creditsBalance - 1 })
      .where(eq(users.id, userId));

    res.json(generation);
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

router.get('/history', authenticateToken, async (req, res): Promise<any> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userGenerations = await db.select()
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt));

    res.json(userGenerations);
  } catch (error) {
    console.error('Error fetching generation history:', error);
    res.status(500).json({ error: 'Failed to fetch generation history' });
  }
});

export default router; 