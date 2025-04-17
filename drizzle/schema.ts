import { pgTable, serial, text, timestamp, integer, decimal, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default('Anonymous User'),
  password: text('password'), // Hashed password for email/password auth
  creditsBalance: integer('credits_balance').notNull().default(5), // Initial credits from basic plan
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const creditsTransactions = pgTable('credits_transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(), // Positive for purchases, negative for usage
  type: text('type').notNull(), // 'purchase', 'usage', 'refund'
  paymentId: text('payment_id'), // For purchase transactions
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cartoonGenerations = pgTable('cartoon_generations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  originalImageUrl: text('original_image_url').notNull(),
  generatedImageUrl: text('generated_image_url').notNull(),
  status: text('status').notNull(), // 'pending', 'completed', 'failed'
  creditsUsed: integer('credits_used').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull(), // 'pending', 'completed', 'failed'
  revenuecatTransactionId: text('revenuecat_transaction_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});