import { db } from '../db';
import { user, creditsTransactions } from '../db/schema';
import { eq } from 'drizzle-orm';

async function addCredits() {
  try {
    // Find the test user
    const testUser = await db.query.user.findFirst({
      where: eq(user.email, 'test@test.com'),
    });

    if (!testUser) {
      console.error('Test user not found');
      return;
    }

    // Add credits transaction
    await db.insert(creditsTransactions).values({
      id: crypto.randomUUID(),
      userId: testUser.id,
      amount: 100, // Adding 100 credits
      type: 'purchase',
      paymentId: 'TEST_CREDITS',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update user's credit balance
    await db.update(user)
      .set({ creditsBalance: testUser.creditsBalance + 100 })
      .where(eq(user.id, testUser.id));

    console.log('Successfully added 100 credits to test@test.com');
  } catch (error) {
    console.error('Error adding credits:', error);
  }
}

addCredits(); 