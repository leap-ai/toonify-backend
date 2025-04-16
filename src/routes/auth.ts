import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';

const router = Router();
const googleClient = new OAuth2Client(config.google.clientId);

// Email/Password Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [user] = await db.insert(users).values({
      email,
      name,
      password: hashedPassword,
    }).returning();

    // Generate token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Email/Password Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.password) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Google Auth
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const { email, name } = payload;

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.email, email!),
    });

    if (!user) {
      [user] = await db.insert(users).values({
        email: email!,
        name: name!,
      }).returning();
    }

    // Generate token
    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    });

    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Error with Google authentication' });
  }
});

// Apple Auth
router.post('/apple', async (req, res) => {
  try {
    const { identityToken } = req.body;

    // Verify Apple token (implementation depends on Apple's auth library)
    // For now, we'll assume the token is verified and contains user info
    const { email, name } = req.body; // This should come from verified token

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      [user] = await db.insert(users).values({
        email,
        name,
      }).returning();
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Error with Apple authentication' });
  }
});

export default router; 