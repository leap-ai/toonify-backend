import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer'; // Re-add multer import
import { eq } from 'drizzle-orm';
import auth from '../auth'; // Assuming auth instance is exported from here
import { db } from '../db'; // Assuming db instance is exported from here
import * as schema from '../db/schema';
import { fromNodeHeaders } from 'better-auth/node';

const router = express.Router();

// --- Multer Configuration for Memory Storage ---
const storage = multer.memoryStorage(); // Use memory storage

const upload = multer({ 
  storage: storage, // Use memory storage
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      // Reject file
      cb(new Error('Only image files are allowed!'));
    }
  }
});
// --- End Multer Configuration ---

// POST /api/users/me/profile-picture 
// Handles multipart/form-data, extracts file buffer, converts to Data URI, saves to DB
router.post('/me/profile-picture', upload.single('profilePicture'), async (req: Request, res: Response, next: NextFunction): Promise<void> => { 
  console.log('[POST /api/users/me/profile-picture] Received request');
  console.log('Request Headers:', JSON.stringify(req.headers, null, 2)); // Log incoming headers

  try {
    // 1. Authenticate user 
    console.log('Attempting to get session...');
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    console.log('Get Session Result:', session ? { userId: session.user.id } : null); // Log session result (don't log full session)

    if (!session?.user?.id) {
      console.log('Authentication failed: No valid session found.');
      res.status(401).json({ error: 'Unauthorized' });
      return; 
    }
    const userId = session.user.id;
    console.log(`Authenticated as user: ${userId}`);

    // 2. Check if file was uploaded by multer and is in memory
    if (!req.file || !req.file.buffer) {
       res.status(400).json({ error: 'No profile picture file uploaded or file buffer missing.' });
       return;
    }

    // 3. Convert buffer to Data URI
    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const base64String = fileBuffer.toString('base64');
    const imageDataUri = `data:${mimeType};base64,${base64String}`;

    // 4. Update user record in database with the Data URI
    await db
      .update(schema.user)
      .set({ image: imageDataUri })
      .where(eq(schema.user.id, userId));

    console.log(`User ${userId} updated profile picture (converted from upload to Data URI)`);
    
    // 5. Return success message (optionally the new URI, though client might not need it)
    res.status(200).json({ 
      message: 'Profile picture updated successfully',
      imageUrl: imageDataUri // Return the Data URI for consistency if needed
    });

  } catch (error: any) {
    console.error('Error processing profile picture upload:', error);
    // Handle specific multer errors (like file size limit)
    if (error instanceof multer.MulterError) {
       res.status(400).json({ error: error.message });
       return;
    }
    // Handle file type error from filter
    if (error.message === 'Only image files are allowed!') {
        res.status(400).json({ error: error.message });
        return;
    }
    // Pass other errors to the default Express error handler
    next(error); 
  }
});

export default router; 