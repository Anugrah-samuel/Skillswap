import { 
  type CreditTransaction, 
  type InsertCreditTransaction,
  type User 
} from "@shared/schema";
import { storage } from "../storage";

export interface CreditsServiceInterface {
  getUserBalance(userId: string): Promise<number>;
  addCredits(userId: string, amount: number, type: string, description?: string, relatedId?: string): Promise<CreditTransaction>;
  deductCredits(userId: string, amount: number, type: string, description?: string, relatedId?: string): Promise<CreditTransaction>;
  getTransactionHistory(userId: string, limit?: number): Promise<CreditTransaction[]>;
  processSessionCompletion(sessionId: string): Promise<void>;
  purchaseCredits(userId: string, amount: number, paymentMethodId: string): Promise<CreditTransaction>;
}

export class CreditsService implements CreditsServiceInterface {
  
  /**
   * Get the current credit balance for a user
   */
  async getUserBalance(userId: string): Promise<number> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.creditBalance;
  }

  /**
   * Add credits to a user's balance
   */
  async addCredits(
    userId: string, 
    amount: number, 
    type: string, 
    description?: string, 
    relatedId?: string
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('Credit amount must be positive');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create transaction record
    const transaction = await storage.createCreditTransaction({
      userId,
      amount,
      type,
      description,
      relatedId,
    });

    // Update user balance
    const newBalance = user.creditBalance + amount;
    await storage.updateUser(userId, { creditBalance: newBalance });

    return transaction;
  }

  /**
   * Deduct credits from a user's balance
   */
  async deductCredits(
    userId: string, 
    amount: number, 
    type: string, 
    description?: string, 
    relatedId?: string
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('Credit amount must be positive');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.creditBalance < amount) {
      throw new Error('Insufficient credits');
    }

    // Create transaction record (negative amount for deduction)
    const transaction = await storage.createCreditTransaction({
      userId,
      amount: -amount,
      type,
      description,
      relatedId,
    });

    // Update user balance
    const newBalance = user.creditBalance - amount;
    await storage.updateUser(userId, { creditBalance: newBalance });

    return transaction;
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(userId: string, limit?: number): Promise<CreditTransaction[]> {
    const transactions = await storage.getCreditTransactionsByUser(userId);
    
    // Sort by creation date (newest first)
    const sortedTransactions = transactions.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Apply limit if specified
    if (limit && limit > 0) {
      return sortedTransactions.slice(0, limit);
    }

    return sortedTransactions;
  }

  /**
   * Process credit transactions when a skill session is completed
   * Awards credits to both teacher and student
   */
  async processSessionCompletion(sessionId: string): Promise<void> {
    const session = await storage.getSkillSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'completed') {
      throw new Error('Session is not completed');
    }

    // Award credits to teacher (amount specified in session)
    await this.addCredits(
      session.teacherId,
      session.creditsAmount,
      'earned',
      `Credits earned from teaching session: ${sessionId}`,
      sessionId
    );

    // Award participation credits to student (smaller amount)
    const participationCredits = Math.max(1, Math.floor(session.creditsAmount * 0.2));
    await this.addCredits(
      session.studentId,
      participationCredits,
      'earned',
      `Participation credits from session: ${sessionId}`,
      sessionId
    );

    // Update user session counts
    const teacher = await storage.getUser(session.teacherId);
    const student = await storage.getUser(session.studentId);

    if (teacher) {
      await storage.updateUser(session.teacherId, {
        totalSessionsTaught: teacher.totalSessionsTaught + 1,
        skillPoints: teacher.skillPoints + session.creditsAmount,
      });
    }

    if (student) {
      await storage.updateUser(session.studentId, {
        totalSessionsCompleted: student.totalSessionsCompleted + 1,
        skillPoints: student.skillPoints + participationCredits,
      });
    }
  }

  /**
   * Purchase credits using a payment method
   * This is a simplified implementation - in production, this would integrate with Stripe
   */
  async purchaseCredits(userId: string, amount: number, paymentMethodId: string): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('Credit amount must be positive');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // In a real implementation, we would:
    // 1. Validate the payment method
    // 2. Process the payment with Stripe
    // 3. Handle payment failures
    // For now, we'll simulate a successful purchase

    // Simulate payment processing
    const paymentSuccessful = await this.simulatePaymentProcessing(paymentMethodId, amount);
    if (!paymentSuccessful) {
      throw new Error('Payment processing failed');
    }

    // Add credits to user account
    const transaction = await this.addCredits(
      userId,
      amount,
      'purchased',
      `Purchased ${amount} credits`,
      paymentMethodId
    );

    return transaction;
  }

  /**
   * Simulate payment processing (for development/testing)
   * In production, this would be replaced with actual Stripe integration
   */
  private async simulatePaymentProcessing(paymentMethodId: string, amount: number): Promise<boolean> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // For testing, we'll assume payments succeed unless the payment method ID is 'fail'
    return paymentMethodId !== 'fail';
  }
}

// Export singleton instance
export const creditsService = new CreditsService();