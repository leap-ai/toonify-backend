import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { payments, user } from '../db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { fromNodeHeaders } from 'better-auth/node';
import auth from '../auth';
import { config } from '../config';

const router = Router();

// Map RevenueCat product IDs to the number of credits they grant
const PRODUCT_ID_TO_CREDITS: Record<string, number> = {
  'buy_10_credits': 10, 
  'buy_20_credits': 50,
  'buy_100_credits': 100,
};

// IMPORTANT: Need raw body for signature verification BEFORE JSON parsing
const rawBodySaver = (req: Request, res: Response, buf: Buffer, encoding: BufferEncoding) => {
  if (buf && buf.length) {
    (req as any).rawBody = buf.toString(encoding || 'utf8');
  }
};

router.post(
  '/revenuecat', 
  express.raw({ verify: rawBodySaver, type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    const receivedBody = (req as any).rawBody;
    const secret = config.revenuecat.secret; 
    const receivedAuthorization = req.get('Authorization');

    if (!receivedBody) {
      console.warn('Webhook missing body.');
      res.status(400).send('Missing body');
      return;
    }

    let event: any;
    let eventData: any = null;
    try {
      eventData = JSON.parse(receivedBody);
      event = eventData.event;
    } catch (parseError) {
      console.error('Webhook body JSON parsing error:', parseError);
      res.status(400).send('Invalid JSON body');
      return;
    }
    const eventType = event?.type;
    const isTestEvent = eventType === 'TEST';

    console.log(`Received RevenueCat Webhook. Event Type: ${eventType}. Is test Event: ${isTestEvent}`);

    // Validate Secret / Authorization Header (Only if not a test event)
    if (!isTestEvent) { 
        if (!secret) {
            console.error('REVENUECAT_SECRET is not set in environment variables.');
            res.status(500).send('Webhook secret configuration error.');
            return;
        }
        if (!receivedAuthorization) {
            console.warn('Webhook missing Authorization header.');
            res.status(400).send('Missing Authorization header');
            return;
        }
        
        const expectedAuthValue = secret;
        const receivedAuthBuffer = Buffer.from(receivedAuthorization);
        const expectedAuthBuffer = Buffer.from(expectedAuthValue);

        if (receivedAuthBuffer.length !== expectedAuthBuffer.length || 
            !crypto.timingSafeEqual(receivedAuthBuffer, expectedAuthBuffer)) {
            console.warn('Webhook Authorization header mismatch.');
            res.status(401).send('Invalid Authorization header');
            return;
        }
    }

    // Determine the Correct User ID
    let rawAppUserId = event?.app_user_id as string;
    let aliases = event?.aliases as string[] | undefined;
    let correctAppUserId = rawAppUserId;

    if (rawAppUserId && rawAppUserId.startsWith('$RCAnonymousID:') && Array.isArray(aliases)) {
        const nonAnonymousAlias = aliases.find(alias => !alias.startsWith('$RCAnonymousID:'));
        if (nonAnonymousAlias) {
            correctAppUserId = nonAnonymousAlias;
        } else {
            console.warn(`Anonymous ID received with no non-anonymous alias. Cannot assign credits.`, aliases);
            res.status(200).send('Event processed (anonymous ID with no clear alias).');
            return; 
        }
    } else if (!rawAppUserId) {
        console.error('Webhook event missing app_user_id entirely.');
        res.status(200).send('Event processed (missing app_user_id).');
        return;
    }

    // Process specific event types
    if (eventType === 'NON_RENEWING_PURCHASE') {
        const productId = event.product_id;
        const transactionId = event.transaction_id;
        const storeTransactionId = event.store_transaction_id || event.transaction_id;
        const paidAmount = event.price_in_purchased_currency;
        const currency = event.currency;

        if (!correctAppUserId || !productId || !paidAmount || !transactionId || !storeTransactionId) {
         console.error('Webhook event missing essential data.');
         res.status(200).send('Event processed (missing essential data).');
         return;
        }

        const creditsToAdd = PRODUCT_ID_TO_CREDITS[productId];

        if (creditsToAdd === undefined) {
          console.warn(`No credit amount defined for product ID: ${productId}`);
          res.status(200).send('Event processed (unknown product ID).');
          return;
        }

        try {
          // Idempotency Check
          const existingPayment = await db.select({ id: payments.id })
            .from(payments)
            .where(eq(payments.transactionId, transactionId))
            .limit(1);

          if (existingPayment.length > 0) {
            console.log(`Duplicate webhook event detected. Transaction ${transactionId} already processed.`);
            res.status(200).send('Event processed (duplicate).');
            return;
          }
          
          // Update User Credits
          const updatedUsers = await db
            .update(user)
            .set({ 
               creditsBalance: sql`${user.creditsBalance} + ${creditsToAdd}` 
             })
           .where(eq(user.id, correctAppUserId))
           .returning({ newCredits: user.creditsBalance });

          if (updatedUsers.length === 0) {
           console.error(`User not found with app_user_id: ${correctAppUserId}`);
           res.status(200).send('Event processed (user not found).');
           return 
          } else {
           console.log(`Added ${creditsToAdd} credits to user. New balance: ${updatedUsers[0].newCredits}`);
            
            // Log Successful Payment
            await db.insert(payments) 
              .values({
                  id: crypto.randomUUID(),
                  userId: correctAppUserId,
                  amount: paidAmount,
                  currency: currency,
                  status: 'Success',
                  transactionId: transactionId, 
                  storeTransactionId: storeTransactionId, 
                  productId: productId,
                  createdAt: new Date(),
              });
          }

        } catch (dbError) {
          console.error(`Database error processing webhook:`, dbError);
          res.status(500).send('Database error during webhook processing.');
          return;
        }
    }
    
    res.status(200).send('Webhook received successfully.');
  }
);

// Get payment history
router.get('/history', async (req, res): Promise<any> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const paymentHistory = await db.select({
      id: payments.id,
      userId: payments.userId,
      amount: payments.amount,
      status: payments.status,
      currency: payments.currency, 
      createdAt: payments.createdAt,
      productId: payments.productId,
      // Adding type field based on productId for frontend display
      type: sql`COALESCE(${payments.productId}, 'payment')`,
    })
    .from(payments)
    .where(eq(payments.userId, session.user.id))
    .orderBy(desc(payments.createdAt));

    res.json(paymentHistory);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 