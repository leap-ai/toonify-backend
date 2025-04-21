import { Router } from 'express';
import { generateCartoonImage, uploadImageToFal } from '../services/imageGeneration';
import { db } from '../db';
import { generations, user } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import multer from 'multer';
import { fromNodeHeaders } from 'better-auth/node';
import auth from '../auth';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

router.post('/generate', upload.single('image'), async (req, res): Promise<any> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Check user credits
    const [userVal] = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userVal || userVal.creditsBalance <= 0) {
      return res.status(403).json({ error: 'Insufficient credits' });
    }

    // Ensure we have a valid buffer
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      return res.status(400).json({ error: 'Invalid file data' });
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
      id: crypto.randomUUID(),
      userId: session.user.id,
      originalImageUrl: falImageUrl,
      cartoonImageUrl: cartoonImageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'completed',
      creditsUsed: 1
    }).returning();

    // Deduct credits
    await db.update(user)
      .set({ creditsBalance: userVal.creditsBalance - 1 })
      .where(eq(user.id, session.user.id));

    res.json(generation);
  } catch (error) {
    console.error('Error in generation:', error);
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size is 5MB' });
      }
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', async (req, res): Promise<any> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    }); 

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userGenerations = await db.select()
      .from(generations)
      .where(eq(generations.userId, session?.user?.id))
      .orderBy(desc(generations.createdAt));

    res.json(userGenerations);
  } catch (error) {
    console.error('Error fetching generation history:', error);
    res.status(500).json({ error: 'Failed to fetch generation history' });
  }
});

export default router; 