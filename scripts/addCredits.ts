import { db } from '../src/db';
import { users, creditsTransactions } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function addCredits() {
  try {
    // Find the test user
    const testUser = await db.query.users.findFirst({
      where: eq(users.email, 'test@test.com'),
    });

    if (!testUser) {
      console.error('Test user not found');
      return;
    }

    // Add credits transaction
    await db.insert(creditsTransactions).values({
      userId: testUser.id,
      amount: 100, // Adding 100 credits
      type: 'purchase',
      paymentId: 'TEST_CREDITS',
    });

    // Update user's credit balance
    await db.update(users)
      .set({ creditsBalance: testUser.creditsBalance + 100 })
      .where(eq(users.id, testUser.id));

    console.log('Successfully added 100 credits to test@test.com');
  } catch (error) {
    console.error('Error adding credits:', error);
  }
}

addCredits(); 