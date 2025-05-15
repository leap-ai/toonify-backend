import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import multer from 'multer';
import { fromNodeHeaders } from 'better-auth/node';
import auth from '../auth';
import { db } from '../db';
import { generations, user } from '../db/schema';
import { uploadImageToFal } from '../services/falService';
import { OpenAIImageGenService, ImageVariant } from '../services/openAIImageGen';
import { config } from '../config';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 25 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

// Define allowed variants - sync with ImageVariant in service
const ALLOWED_VARIANTS: ImageVariant[] = ['pixar', 'ghiblix', 'sticker', 'plushy', 'kawaii', 'anime'];

// Initialize OpenAI service
const openAIService = new OpenAIImageGenService(config.openai.apiKey);

router.post('/generate', upload.single('image'), async (req, res): Promise<any> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    console.log('isPro', req.headers.isPro);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // --- Get variant from request body ---
    const variant = req.body.variant as ImageVariant; 
    if (!variant || !ALLOWED_VARIANTS.includes(variant)) {
      console.warn(`Invalid or missing variant: ${variant}. Defaulting to 'ghiblix'.`);
    }
    const selectedVariant = ALLOWED_VARIANTS.includes(variant) ? variant : 'ghiblix';
    // --------------------------------------

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

    // Create a standard File object from the Multer file buffer
    const inputFile = new File([file.buffer], file.originalname, { type: file.mimetype });

    // Upload image to fal.ai storage - needs the created File object
    const originalImageUrl = await uploadImageToFal(inputFile);
    
    // Generate cartoon image using OpenAI service
    const cartoonImageUrl = await openAIService.generateCartoonImage({
      image: inputFile,
      variant: selectedVariant,
    });
    console.log(`Image generated with variant ${selectedVariant}:`, cartoonImageUrl);

    // Save generation to database
    const [generation] = await db.insert(generations).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      originalImageUrl,
      cartoonImageUrl,
      variant: selectedVariant,
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
        return res.status(400).json({ error: 'File size too large. Maximum size is 25MB' });
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

// Delete a specific generation by ID
router.delete('/:id', async (req, res): Promise<any> => {
  try {
    const generationId = req.params.id;
    
    // Validate request
    if (!generationId) {
      return res.status(400).json({ error: 'Generation ID is required' });
    }
    
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // First check if the generation exists and belongs to the user
    const [existingGeneration] = await db.select()
      .from(generations)
      .where(eq(generations.id, generationId))
      .limit(1);
    
    if (!existingGeneration) {
      return res.status(404).json({ error: 'Generation not found' });
    }
    
    // Verify the generation belongs to the authenticated user
    if (existingGeneration.userId !== session.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this generation' });
    }
    
    // Delete the generation from the database
    await db.delete(generations)
      .where(eq(generations.id, generationId));
    
    // Return success response
    res.json({ success: true, message: 'Generation deleted successfully' });
  } catch (error) {
    console.error('Error deleting generation:', error);
    res.status(500).json({ error: 'Failed to delete the generation' });
  }
});

export default router; 