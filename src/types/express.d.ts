import { User } from '../db/schema';
import 'express';

declare module 'express' {
  interface Request {
    user?: User;
  }
}