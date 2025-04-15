import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwtDecode from 'jwt-decode';
import jwksClient from 'jwks-rsa';
import fetch from 'node-fetch';
import formbody from '@fastify/formbody';

interface User {
  id: number;
  email: string;
  password: string;
}

interface JwtPayload {
  id: number;
  email: string;
}

interface GooglePayload {
  email: string;
}

interface ApplePayload {
  email: string;
  header: {
    kid: string;
  };
}

const { Pool } = pg;
dotenv.config();

const fastify: FastifyInstance = Fastify();
await fastify.register(cors);
await fastify.register(formbody);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || '';

async function getUserByEmail(email: string): Promise<User | undefined> {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

async function createUser(email: string, passwordHash: string): Promise<User> {
  const { rows } = await pool.query(
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
    [email, passwordHash]
  );
  return rows[0];
}

fastify.post<{ Body: { email: string; password: string } }>('/auth/signup', async (req, reply) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = await createUser(email, hash);
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  return { token };
});

fastify.post<{ Body: { email: string; password: string } }>('/auth/login', async (req, reply) => {
  const { email, password } = req.body;
  const user = await getUserByEmail(email);
  if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  return { token };
});

fastify.post<{ Body: { id_token: string } }>('/auth/google', async (req, reply) => {
  const { id_token } = req.body;
  const ticket = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
  const payload = await ticket.json() as GooglePayload;
  if (!payload.email) return reply.code(400).send({ error: 'Invalid token' });
  let user = await getUserByEmail(payload.email);
  if (!user) user = await createUser(payload.email, '');
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  return { token };
});

const appleClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
});

fastify.post<{ Body: { id_token: string } }>('/auth/apple', async (req, reply) => {
  const { id_token } = req.body;
  const decoded = jwtDecode<ApplePayload>(id_token);
  const key = await appleClient.getSigningKey(decoded.header.kid);
  const pubKey = key.getPublicKey();
  const payload = jwt.verify(id_token, pubKey, { algorithms: ['RS256'] }) as ApplePayload;
  if (!payload.email) return reply.code(400).send({ error: 'Invalid token' });
  let user = await getUserByEmail(payload.email);
  if (!user) user = await createUser(payload.email, '');
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  return { token };
});

fastify.get('/auth/me', async (req, reply) => {
  const auth = req.headers.authorization;
  const token = auth?.split(' ')[1];
  try {
    const user = jwt.verify(token || '', JWT_SECRET) as JwtPayload;
    return { user };
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
});

fastify.post('/cartoonify', async (req, reply) => {
  const auth = req.headers.authorization;
  const token = auth?.split(' ')[1];
  try {
    jwt.verify(token || '', JWT_SECRET);
    await new Promise(resolve => setTimeout(resolve, 3000));
    return {
      cartoonUrl: 'https://v3.fal.media/files/kangaroo/BBaHWx09TiVHI7-uo6yI8_27a0c5437b7d4cd19ac0540d90092ead.png'
    };
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
});

fastify.listen({ port: 3000 }, err => {
  if (err) throw err;
  console.log('Backend running on http://localhost:3000');
}); 