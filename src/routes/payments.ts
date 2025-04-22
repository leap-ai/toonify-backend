import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { payments, user } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { fromNodeHeaders } from 'better-auth/node';
import auth from '../auth';

const router = Router();

// --- Configuration --- 
// Map RevenueCat product IDs to the number of credits they grant
const PRODUCT_ID_TO_CREDITS: Record<string, number> = {
  'buy_10_credits': 10, 
  'buy_20_credits': 50,
  'buy_100_credits': 100,
};

// --- Middleware for Raw Body --- 
// IMPORTANT: Need raw body for signature verification BEFORE JSON parsing
// This middleware attaches the raw buffer to req.rawBody
const rawBodySaver = (req: Request, res: Response, buf: Buffer, encoding: BufferEncoding) => {
  if (buf && buf.length) {
    (req as any).rawBody = buf.toString(encoding || 'utf8');
  }
};

// --- Webhook Handler --- 
router.post(
  '/webhook', 
  express.raw({ verify: rawBodySaver, type: 'application/json' }), // Use express.raw first
  async (req: Request, res: Response): Promise<void> => {
    const signature = req.get('X-RC-Webhook-Signature'); // Correct header name from RC docs v4
    const receivedBody = (req as any).rawBody; // Get the raw body saved by middleware
    const secret = process.env.REVENUECAT_SECRET;

    console.log('Received RevenueCat Webhook');

    // --- 1. Validate Secret --- 
    if (!secret) {
      console.error('REVENUECAT_SECRET is not set in environment variables.');
      res.status(500).send('Webhook secret configuration error.');
      return;
    }

    // --- 2. Validate Signature --- 
    if (!signature || !receivedBody) {
      console.warn('Webhook missing signature or body.');
      res.status(400).send('Missing signature or body');
      return;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(receivedBody)
        .digest('hex'); // RC uses hex digest

      // Compare signatures
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.warn('Webhook signature mismatch.');
        res.status(401).send('Invalid signature');
        return;
      }
      console.log('Webhook signature verified successfully.');

    } catch (error) {
      console.error('Error during signature verification:', error);
      res.status(500).send('Internal server error during verification.');
      return;
    }

    // --- 3. Process Validated Event --- 
    const eventData = JSON.parse(receivedBody); // Now parse the JSON
    const event = eventData.event; // The actual event payload
    const eventType = eventData.type; // The type of event (e.g., NON_RENEWING_PURCHASE)

    console.log(`Processing event type: ${eventType} for user: ${event.app_user_id}`);

    // --- 4. Grant Credits Logic & Log Payment --- 
    // Focus on events indicating a successful one-time purchase
    if (eventType === 'NON_RENEWING_PURCHASE') { 
      const productId = event.product_id;
      const appUserId = event.app_user_id as string;
      const transactionId = event.transaction_id; // RC transaction ID
      const storeTransactionId = event.store_transaction_id; // Apple/Google transaction ID
      const paidAmount = event.price_in_purchased_currency; // Actual price paid
      const currency = event.currency; // Currency code (e.g., USD)

      // Validate essential data from webhook
      if (!appUserId || !productId || !paidAmount || !transactionId || !storeTransactionId) {
        console.error('Webhook event missing essential data (user, product, price, ids)');
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
        console.log(`Processing successful purchase for user ${appUserId}, product ${productId}`);
        
        // --- Update User Credits --- 
        console.log(`Attempting to add ${creditsToAdd} credits to user ${appUserId}`);
        const updatedUsers = await db
          .update(user)
          .set({ 
             creditsBalance: sql`${user.creditsBalance} + ${creditsToAdd}` 
           })
          .where(eq(user.id, appUserId))
          .returning({ updatedId: user.id, newCredits: user.creditsBalance });

        if (updatedUsers.length === 0) {
          console.error(`User not found with app_user_id: ${appUserId}`);
          res.status(200).send('Event processed (user not found).');
          return 
        } else {
          console.log(`Successfully added ${creditsToAdd} credits to user ${appUserId}. New balance approx: ${updatedUsers[0].newCredits}`);
          
          // --- Log Successful Payment --- 
          console.log(`Logging successful transaction to payments table for user ${appUserId}`);
          await db.insert(payments) 
            .values({
                id: crypto.randomUUID(),
                userId: appUserId,
                amount: paidAmount, // Store the actual price paid
                currency: currency, // Store the currency
                status: 'Success', // Set status to Success
                // Ensure these column names match your schema exactly
                transactionId: transactionId, 
                storeTransactionId: storeTransactionId, 
                productId: productId,
                // Remove or adjust any fields not in your payments schema
            });
          console.log(`Payment logged successfully for user ${appUserId}`);
        }

      } catch (dbError) {
        console.error(`Database error processing webhook for user ${appUserId}:`, dbError);
        res.status(500).send('Database error during webhook processing.');
        return;
      }
    } else {
        console.log(`Ignoring event type: ${eventType}`);
    }
    // --- 5. Respond OK to RevenueCat --- 
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

    const [id, userId, amount, status, currency, createdAt] = await db.select()
      .from(payments)
      .where(eq(payments.userId, session.user.id))
      .orderBy(payments.createdAt);

    res.json({id, userId, amount, status, currency, createdAt});
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 