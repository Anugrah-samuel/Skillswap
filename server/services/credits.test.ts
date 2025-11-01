import { describe, it, expect, beforeEach } from 'vitest';
import { CreditsService } from './credits';
import { storage } from '../storage';
import type { User, SkillSession } from '@shared/schema';

describe('CreditsService', () => {
  let creditsService: CreditsService;
  let testUser: User;
  let testTeacher: User;
  let testStudent: User;

  beforeEach(async () => {
    creditsService = new CreditsService();
    
    // Create test users
    testUser = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User',
      creditBalance: 100,
    });

    testTeacher = await storage.createUser({
      username: 'teacher',
      email: 'teacher@example.com',
      password: 'hashedpassword',
      fullName: 'Test Teacher',
      creditBalance: 50,
    });

    testStudent = await storage.createUser({
      username: 'student',
      email: 'student@example.com',
      password: 'hashedpassword',
      fullName: 'Test Student',
      creditBalance: 25,
    });
  });

  describe('getUserBalance', () => {
    it('should return user credit balance', async () => {
      const balance = await creditsService.getUserBalance(testUser.id);
      expect(balance).toBe(100);
    });

    it('should throw error for non-existent user', async () => {
      await expect(creditsService.getUserBalance('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('addCredits', () => {
    it('should add credits to user balance', async () => {
      const transaction = await creditsService.addCredits(testUser.id, 50, 'earned', 'Test earning');
      
      expect(transaction.userId).toBe(testUser.id);
      expect(transaction.amount).toBe(50);
      expect(transaction.type).toBe('earned');
      expect(transaction.description).toBe('Test earning');
      
      const newBalance = await creditsService.getUserBalance(testUser.id);
      expect(newBalance).toBe(150);
    });

    it('should throw error for negative amount', async () => {
      await expect(creditsService.addCredits(testUser.id, -10, 'earned')).rejects.toThrow('Credit amount must be positive');
    });

    it('should throw error for zero amount', async () => {
      await expect(creditsService.addCredits(testUser.id, 0, 'earned')).rejects.toThrow('Credit amount must be positive');
    });

    it('should throw error for non-existent user', async () => {
      await expect(creditsService.addCredits('nonexistent', 50, 'earned')).rejects.toThrow('User not found');
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits from user balance', async () => {
      const transaction = await creditsService.deductCredits(testUser.id, 30, 'spent', 'Test spending');
      
      expect(transaction.userId).toBe(testUser.id);
      expect(transaction.amount).toBe(-30);
      expect(transaction.type).toBe('spent');
      expect(transaction.description).toBe('Test spending');
      
      const newBalance = await creditsService.getUserBalance(testUser.id);
      expect(newBalance).toBe(70);
    });

    it('should throw error for insufficient credits', async () => {
      await expect(creditsService.deductCredits(testUser.id, 150, 'spent')).rejects.toThrow('Insufficient credits');
    });

    it('should throw error for negative amount', async () => {
      await expect(creditsService.deductCredits(testUser.id, -10, 'spent')).rejects.toThrow('Credit amount must be positive');
    });

    it('should throw error for non-existent user', async () => {
      await expect(creditsService.deductCredits('nonexistent', 50, 'spent')).rejects.toThrow('User not found');
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history for user', async () => {
      // Create some transactions with small delays to ensure different timestamps
      await creditsService.addCredits(testUser.id, 25, 'earned', 'First earning');
      await new Promise(resolve => setTimeout(resolve, 10));
      await creditsService.deductCredits(testUser.id, 10, 'spent', 'First spending');
      await new Promise(resolve => setTimeout(resolve, 10));
      await creditsService.addCredits(testUser.id, 15, 'purchased', 'Credit purchase');
      
      const history = await creditsService.getTransactionHistory(testUser.id);
      
      expect(history).toHaveLength(3);
      expect(history[0].description).toBe('Credit purchase'); // Most recent first
      expect(history[1].description).toBe('First spending');
      expect(history[2].description).toBe('First earning');
    });

    it('should limit transaction history when limit is specified', async () => {
      // Create multiple transactions with small delays to ensure different timestamps
      await creditsService.addCredits(testUser.id, 10, 'earned', 'Transaction 1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await creditsService.addCredits(testUser.id, 20, 'earned', 'Transaction 2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await creditsService.addCredits(testUser.id, 30, 'earned', 'Transaction 3');
      
      const history = await creditsService.getTransactionHistory(testUser.id, 2);
      
      expect(history).toHaveLength(2);
      expect(history[0].description).toBe('Transaction 3'); // Most recent first
      expect(history[1].description).toBe('Transaction 2');
    });

    it('should return empty array for user with no transactions', async () => {
      const history = await creditsService.getTransactionHistory(testStudent.id);
      expect(history).toHaveLength(0);
    });
  });

  describe('processSessionCompletion', () => {
    let testSession: SkillSession;

    beforeEach(async () => {
      // Create a completed skill session
      testSession = await storage.createSkillSession({
        matchId: 'match123',
        teacherId: testTeacher.id,
        studentId: testStudent.id,
        skillId: 'skill123',
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 3600000), // 1 hour later
        status: 'completed',
        creditsAmount: 20,
      });
    });

    it('should award credits to both teacher and student', async () => {
      const initialTeacherBalance = await creditsService.getUserBalance(testTeacher.id);
      const initialStudentBalance = await creditsService.getUserBalance(testStudent.id);
      
      await creditsService.processSessionCompletion(testSession.id);
      
      const finalTeacherBalance = await creditsService.getUserBalance(testTeacher.id);
      const finalStudentBalance = await creditsService.getUserBalance(testStudent.id);
      
      expect(finalTeacherBalance).toBe(initialTeacherBalance + 20); // Full amount
      expect(finalStudentBalance).toBe(initialStudentBalance + 4); // 20% participation credits
    });

    it('should update user session counts and skill points', async () => {
      await creditsService.processSessionCompletion(testSession.id);
      
      const updatedTeacher = await storage.getUser(testTeacher.id);
      const updatedStudent = await storage.getUser(testStudent.id);
      
      expect(updatedTeacher?.totalSessionsTaught).toBe(1);
      expect(updatedTeacher?.skillPoints).toBe(20);
      expect(updatedStudent?.totalSessionsCompleted).toBe(1);
      expect(updatedStudent?.skillPoints).toBe(4);
    });

    it('should throw error for non-existent session', async () => {
      await expect(creditsService.processSessionCompletion('nonexistent')).rejects.toThrow('Session not found');
    });

    it('should throw error for non-completed session', async () => {
      const incompleteSession = await storage.createSkillSession({
        matchId: 'match456',
        teacherId: testTeacher.id,
        studentId: testStudent.id,
        skillId: 'skill456',
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 3600000),
        status: 'scheduled',
        creditsAmount: 15,
      });

      await expect(creditsService.processSessionCompletion(incompleteSession.id)).rejects.toThrow('Session is not completed');
    });
  });

  describe('purchaseCredits', () => {
    it('should purchase credits successfully', async () => {
      const initialBalance = await creditsService.getUserBalance(testUser.id);
      
      const transaction = await creditsService.purchaseCredits(testUser.id, 100, 'payment_method_123');
      
      expect(transaction.userId).toBe(testUser.id);
      expect(transaction.amount).toBe(100);
      expect(transaction.type).toBe('purchased');
      expect(transaction.relatedId).toBe('payment_method_123');
      
      const finalBalance = await creditsService.getUserBalance(testUser.id);
      expect(finalBalance).toBe(initialBalance + 100);
    });

    it('should throw error for failed payment', async () => {
      await expect(creditsService.purchaseCredits(testUser.id, 100, 'fail')).rejects.toThrow('Payment processing failed');
    });

    it('should throw error for negative amount', async () => {
      await expect(creditsService.purchaseCredits(testUser.id, -50, 'payment_method_123')).rejects.toThrow('Credit amount must be positive');
    });

    it('should throw error for non-existent user', async () => {
      await expect(creditsService.purchaseCredits('nonexistent', 100, 'payment_method_123')).rejects.toThrow('User not found');
    });
  });
});