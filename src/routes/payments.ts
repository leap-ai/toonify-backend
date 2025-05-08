import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { payments, user } from '../db/schema';
import { SQL, desc, eq, sql } from 'drizzle-orm';
import { fromNodeHeaders } from 'better-auth/node';
import auth from '../auth';
import { config } from '../config';
import { getSubscriptionPlan } from '../config/subscriptions';
import { addDays } from 'date-fns';

const router = Router();

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
    // Let's expand this to handle subscription events as well
    const relevantEventTypes = [
      'INITIAL_PURCHASE', 
      'RENEWAL', 
      'PRODUCT_CHANGE', // User upgrades/downgrades/crossgrades
      // 'NON_RENEWING_PURCHASE' // For one-time credit packs - No longer offering
      'EXPIRATION', // When a subscription expires
      'CANCELLATION', // When a subscription is cancelled (e.g., user opts out of renewal)
      'UNCANCELLATION', // When a subscription is uncancelled (e.g., user opts back in to renewal)
      'BILLING_ISSUE', // When a subscription has a billing issue (handled for grace period of 16 days)
    ];

    if (relevantEventTypes.includes(eventType)) {
        const productId = event.product_id as string;
        const transactionId = event.transaction_id as string; // Ensure this is the correct field for idempotency
        const storeTransactionId = event.store_transaction_id || event.transaction_id as string;
        const paidAmount = event.price_in_purchased_currency as number; // or event.price
        const currency = event.currency as string;
        const eventTimestampMs = event.event_timestamp_ms as number;

        if (!correctAppUserId || !productId) { // Basic check
         console.error(`Webhook event ${eventType} missing essential data (userId or productId).`);
         res.status(200).send('Event processed (missing essential data).'); // Ack to RC
         return;
        }

        // Idempotency Check using event.id or a unique transaction identifier from the event
        // RevenueCat events have an 'id' field which is unique per event.
        const eventId = event.id as string;
        if (!eventId) {
            console.error(`Webhook event ${eventType} missing event.id for idempotency key.`);
            // Potentially fallback to transactionId if event.id is not always present,
            // but event.id is preferred for webhook idempotency.
            res.status(400).send('Missing event.id for idempotency.');
            return;
        }

        try {
            const existingPayment = await db.select({ id: payments.id })
                .from(payments)
                // Use event.id for idempotency key if it's unique per delivery attempt of an event.
                // If transaction_id is more suitable for business logic idempotency (e.g. only one purchase per transaction_id)
                // then that's fine, but webhook delivery retries should ideally use event.id.
                // For now, assuming event.id is the unique webhook event identifier.
                .where(eq(payments.transactionId, eventId)) // Using eventId as transactionId for this log
                .limit(1);

            if (existingPayment.length > 0) {
                console.log(`Duplicate webhook event ID detected: ${eventId}. Already processed.`);
                res.status(200).send('Event processed (duplicate event ID).');
                return;
            }

            // Handle BILLING_ISSUE separately as it has a specific update and logging path
            if (eventType === 'BILLING_ISSUE') {
                console.warn(`Billing issue for user ${correctAppUserId}, product ${productId}. Payment may be retrying.`);

                // Update user to set subscriptionInGracePeriod = true
                await db.update(user)
                    .set({
                      subscriptionInGracePeriod: true,
                      updatedAt: new Date(),
                    })
                    .where(eq(user.id, correctAppUserId));
                console.log(`User ${correctAppUserId} marked with subscriptionInGracePeriod = true.`);

                // Log the billing issue event in payments table
                await db.insert(payments).values({
                  id: crypto.randomUUID(),
                  userId: correctAppUserId,
                  amount: 0, // No amount collected for a billing issue
                  currency: currency || 'USD',
                  status: 'BillingIssue',
                  transactionId: eventId, // Use the RevenueCat event ID for tracing
                  storeTransactionId: storeTransactionId || transactionId, 
                  productId: productId,
                  createdAt: new Date(eventTimestampMs),
                });
                console.log(`BillingIssue event logged for user ${correctAppUserId}, event ID: ${eventId}`);

                res.status(200).send('Event processed (billing issue logged).');
                return;
            }

            const subscriptionPlan = getSubscriptionPlan(productId);
            let creditsToUpdate: number | undefined = undefined;
            let newIsProMember: boolean | undefined = undefined;
            let newProMembershipExpiresAt: Date | null | undefined = undefined;
            let newSubscriptionInGracePeriod: boolean | undefined = undefined;

            if (eventType === 'EXPIRATION') {
                // Handle subscription expiration
                console.log(`Processing subscription expiration for user: ${correctAppUserId}`);
                newIsProMember = false;
                newProMembershipExpiresAt = null;
                newSubscriptionInGracePeriod = false;
            } else if (eventType === 'UNCANCELLATION') {
                // Handle subscription un-cancellation
                console.log(`Processing un-cancellation for user: ${correctAppUserId}, product: ${productId}`);
                newIsProMember = true;
                newSubscriptionInGracePeriod = false;
            } else if (subscriptionPlan) {
                // It's a subscription product (INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE)
                console.log(`Processing subscription product: ${productId}`);
                creditsToUpdate = subscriptionPlan.creditsGranted;
                newIsProMember = true;
                const eventDate = new Date(eventTimestampMs);
                newProMembershipExpiresAt = addDays(eventDate, subscriptionPlan.durationDays);
                newSubscriptionInGracePeriod = false;
            } else {
                console.warn(`Unknown product ID or unhandled event type for product: ${productId}, eventType: ${eventType}`);
                res.status(200).send('Event processed (unknown product or unhandled event/product combo).');
                return;
            }

            // For CANCELLATION events with UNSUBSCRIBE reason, we don't update user record here.
            // Benefits continue until the EXPIRATION event for the current period.
            if (eventType === 'CANCELLATION' && event.cancel_reason === 'UNSUBSCRIBE') {
                console.log(`User ${correctAppUserId} cancelled auto-renewal for product ${productId}. Benefits continue until expiration.`);
                // No change to user.isProMember or user.proMembershipExpiresAt here.
                // The EXPIRATION event will handle the termination of benefits.
                // We still log the payment record for this CANCELLATION event for audit purposes if needed.
                // However, typically cancellation events might not need a separate payment record unless it's a refund.
                // For now, let's assume we only log to console and don't create/update user or payment record for UNSUBSCRIBE.
                res.status(200).send('Event processed (Cancellation/Unsubscribe noted).');
                return; // Skip user/payment update for this specific scenario
            }

            if (creditsToUpdate === undefined && newIsProMember === undefined && eventType !== 'EXPIRATION') {
                console.log(`No action defined for product ID: ${productId} and event type: ${eventType}`);
                res.status(200).send('Event processed (no action defined).');
                return;
            }
            
            // Prepare user update fields
            // Explicitly type updateData to allow SQL for creditsBalance and include subscriptionInGracePeriod
            const updateData: Partial<Omit<typeof user.$inferInsert, 'creditsBalance' | 'subscriptionInGracePeriod'>> & { 
                creditsBalance?: number | SQL; 
                subscriptionInGracePeriod?: boolean;
            } = {};

            if (creditsToUpdate !== undefined) {
              updateData.creditsBalance = sql`${user.creditsBalance} + ${creditsToUpdate}`;
            }
            if (newIsProMember !== undefined) {
              updateData.isProMember = newIsProMember;
            }
            if (newProMembershipExpiresAt !== undefined) {
              updateData.proMembershipExpiresAt = newProMembershipExpiresAt;
            }
            if (newSubscriptionInGracePeriod !== undefined) {
                updateData.subscriptionInGracePeriod = newSubscriptionInGracePeriod;
            }
            updateData.updatedAt = new Date();

            if (Object.keys(updateData).length > 1) { // more than just updatedAt
                // Update User Record
                const updatedUsers = await db
                    .update(user)
                    .set(updateData)
                    .where(eq(user.id, correctAppUserId))
                    .returning({ 
                        id: user.id, 
                        newCredits: user.creditsBalance,
                        isPro: user.isProMember, 
                        proExpires: user.proMembershipExpiresAt 
                    });

                if (updatedUsers.length === 0) {
                    console.error(`User not found with app_user_id: ${correctAppUserId} for event ${eventId}`);
                    res.status(200).send('Event processed (user not found).'); // Ack to RC
                    return;
                } else {
                  console.log(`User ${updatedUsers[0].id} updated. Credits: ${updatedUsers[0].newCredits}, IsPro: ${updatedUsers[0].isPro}, ProExpires: ${updatedUsers[0].proExpires}`);
              
                  // Log Successful Payment/Subscription event
                  await db.insert(payments).values({
                    id: crypto.randomUUID(), // This should be unique for the payment record
                    userId: correctAppUserId,
                    amount: paidAmount || 0, // Ensure amount is a number
                    currency: currency || 'USD',
                    status: 'Success',
                    transactionId: eventId, // Using eventId as the primary reference to the webhook event
                    storeTransactionId: storeTransactionId || transactionId, // store's transaction ID
                    productId: productId,
                    createdAt: new Date(eventTimestampMs), // Use event timestamp
                  });
                  console.log(`Payment/Subscription logged for event ID: ${eventId}`);
                }
            }

        } catch (dbError) {
            console.error(`Database error processing webhook for event ID ${eventId}:`, dbError);
            res.status(500).send('Database error during webhook processing.');
            return;
        }
    } else if (eventType === 'TEST') {
        console.log('Received TEST event. No action taken beyond logging.');
    } else {
        console.log(`Unhandled event type: ${eventType}. No action taken.`);
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