import { Router, Request, Response, RequestHandler } from 'express';
import { db } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';

const router = Router();
const googleClient = new OAuth2Client(config.google.clientId);

interface SignupRequest extends Request {
  body: {
    email: string;
    password: string;
    name: string;
  };
}

interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

interface GoogleAuthRequest extends Request {
  body: {
    token: string;
  };
}

interface AppleAuthRequest extends Request {
  body: {
    identityToken: string;
    fullName?: {
      givenName?: string;
      familyName?: string;
    };
    email: string;
  };
}

// Email/Password Signup
const signupHandler: RequestHandler = async (req: SignupRequest, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [user] = await db.insert(users).values({
      email,
      name,
      password: hashedPassword,
      creditsBalance: 0,
    }).returning();

    // Generate token
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
};

// Email/Password Login
const loginHandler: RequestHandler = async (req: LoginRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.password) {
      res.status(400).json({ error: 'Invalid credentials' });
      return;
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(400).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
};

// Google Auth
const googleAuthHandler: RequestHandler = async (req: GoogleAuthRequest, res: Response) => {
  try {
    const { token } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    const { email, name } = payload;

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.email, email!),
    });

    if (!user) {
      const [newUser] = await db.insert(users).values({
        email: email!,
        name: name!,
        creditsBalance: 0,
      }).returning();
      user = newUser;
    }

    // Generate token
    const jwtToken = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: '7d',
    });

    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Error with Google authentication' });
  }
};

// Apple Auth
const appleAuthHandler: RequestHandler = async (req: AppleAuthRequest, res: Response) => {
  try {
    const { identityToken, fullName, email } = req.body;

    if (!identityToken) {
      res.status(400).json({ error: 'Identity token is required' });
      return;
    }

    // In a production app, you would verify the Apple identity token here
    // For now, we'll trust the token and use the provided email and name

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      const [newUser] = await db.insert(users).values({
        email,
        name: fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : 'Apple User',
        creditsBalance: 0,
      }).returning();
      user = newUser;
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ error: 'Error with Apple authentication' });
  }
};

router.post('/signup', signupHandler);
router.post('/login', loginHandler);
router.post('/google', googleAuthHandler);
router.post('/apple', appleAuthHandler);

export default router; 