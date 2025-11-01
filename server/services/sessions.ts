import { 
  type SkillSession, 
  type InsertSkillSession,
  type User,
  type SkillMatch 
} from "@shared/schema";
import { storage } from "../storage";
import { creditsService } from "./credits";
import { notificationService } from "./notifications";

export interface SessionServiceInterface {
  scheduleSession(matchId: string, sessionData: Omit<InsertSkillSession, 'matchId'>): Promise<SkillSession>;
  startSession(sessionId: string): Promise<{ roomId: string; token: string }>;
  endSession(sessionId: string, notes?: string): Promise<SkillSession>;
  cancelSession(sessionId: string, reason: string): Promise<void>;
  getSession(sessionId: string): Promise<SkillSession | undefined>;
  getUpcomingSessions(userId: string): Promise<SkillSession[]>;
  getSessionHistory(userId: string): Promise<SkillSession[]>;
  checkSessionConflicts(userId: string, startTime: Date, endTime: Date, excludeSessionId?: string): Promise<boolean>;
  validateSessionData(sessionData: Partial<InsertSkillSession>): void;
}

export class SessionService implements SessionServiceInterface {
  
  /**
   * Schedule a new skill session
   */
  async scheduleSession(matchId: string, sessionData: Omit<InsertSkillSession, 'matchId'>): Promise<SkillSession> {
    // Validate the match exists and is accepted
    const match = await storage.getMatch(matchId);
    if (!match) {
      throw new Error('Match not found');
    }
    
    if (match.status !== 'accepted') {
      throw new Error('Match must be accepted before scheduling a session');
    }

    // Validate session data
    this.validateSessionData({ ...sessionData, matchId });

    // Check for scheduling conflicts for both participants
    const hasTeacherConflict = await this.checkSessionConflicts(
      sessionData.teacherId, 
      sessionData.scheduledStart, 
      sessionData.scheduledEnd
    );
    
    const hasStudentConflict = await this.checkSessionConflicts(
      sessionData.studentId, 
      sessionData.scheduledStart, 
      sessionData.scheduledEnd
    );

    if (hasTeacherConflict) {
      throw new Error('Teacher has a scheduling conflict at the requested time');
    }

    if (hasStudentConflict) {
      throw new Error('Student has a scheduling conflict at the requested time');
    }

    // Validate that the student has sufficient credits
    const studentBalance = await creditsService.getUserBalance(sessionData.studentId);
    if (studentBalance < sessionData.creditsAmount) {
      throw new Error('Student has insufficient credits for this session');
    }

    // Create the session
    const session = await storage.createSkillSession({
      matchId,
      ...sessionData,
      status: 'scheduled'
    });

    // Deduct credits from student (hold them until session completion)
    await creditsService.deductCredits(
      sessionData.studentId,
      sessionData.creditsAmount,
      'spent',
      `Credits reserved for session: ${session.id}`,
      session.id
    );

    // Schedule session reminders
    await notificationService.scheduleSessionReminder(session);

    return session;
  }

  /**
   * Start a session and create video room
   */
  async startSession(sessionId: string): Promise<{ roomId: string; token: string }> {
    const session = await storage.getSkillSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'scheduled') {
      throw new Error('Session is not in scheduled status');
    }

    // Check if session start time is within acceptable range (e.g., 15 minutes early to 30 minutes late)
    const now = new Date();
    const scheduledStart = new Date(session.scheduledStart);
    const earliestStart = new Date(scheduledStart.getTime() - 15 * 60 * 1000); // 15 minutes early
    const latestStart = new Date(scheduledStart.getTime() + 30 * 60 * 1000); // 30 minutes late

    if (now < earliestStart || now > latestStart) {
      throw new Error('Session can only be started within 15 minutes before to 30 minutes after scheduled time');
    }

    // Generate video room ID and token
    const videoRoomId = await this.createVideoRoom(sessionId);
    const token = await this.generateVideoToken(videoRoomId, sessionId);

    // Update session status and actual start time
    const updatedSession = await storage.updateSkillSession(sessionId, {
      status: 'in_progress',
      actualStart: now,
      videoRoomId
    });

    if (!updatedSession) {
      throw new Error('Failed to update session status');
    }

    return { roomId: videoRoomId, token };
  }

  /**
   * End a session and process credits
   */
  async endSession(sessionId: string, notes?: string): Promise<SkillSession> {
    const session = await storage.getSkillSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'in_progress') {
      throw new Error('Session is not in progress');
    }

    const now = new Date();
    
    // Update session status
    const updatedSession = await storage.updateSkillSession(sessionId, {
      status: 'completed',
      actualEnd: now,
      notes
    });

    if (!updatedSession) {
      throw new Error('Failed to update session status');
    }

    // Process credit transactions for completed session
    await creditsService.processSessionCompletion(sessionId);

    return updatedSession;
  }

  /**
   * Cancel a session and handle refunds
   */
  async cancelSession(sessionId: string, reason: string): Promise<void> {
    const session = await storage.getSkillSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new Error('Cannot cancel a session that is already completed or cancelled');
    }

    const now = new Date();
    const scheduledStart = new Date(session.scheduledStart);
    const hoursUntilSession = (scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine refund amount based on cancellation timing
    let refundAmount = 0;
    if (hoursUntilSession >= 24) {
      // Full refund if cancelled 24+ hours in advance
      refundAmount = session.creditsAmount;
    } else if (hoursUntilSession >= 2) {
      // 50% refund if cancelled 2-24 hours in advance
      refundAmount = Math.floor(session.creditsAmount * 0.5);
    }
    // No refund if cancelled less than 2 hours in advance

    // Update session status
    await storage.updateSkillSession(sessionId, {
      status: 'cancelled',
      notes: `Cancelled: ${reason}`
    });

    // Process refund if applicable
    if (refundAmount > 0) {
      await creditsService.addCredits(
        session.studentId,
        refundAmount,
        'refunded',
        `Refund for cancelled session: ${sessionId}`,
        sessionId
      );
    }
  }

  /**
   * Get upcoming sessions for a user
   */
  async getUpcomingSessions(userId: string): Promise<SkillSession[]> {
    const allSessions = await storage.getSkillSessionsByUser(userId);
    const now = new Date();
    
    return allSessions
      .filter(session => 
        (session.status === 'scheduled' || session.status === 'in_progress') &&
        new Date(session.scheduledStart) > now
      )
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
  }

  /**
   * Get a single session by ID
   */
  async getSession(sessionId: string): Promise<SkillSession | undefined> {
    return await storage.getSkillSession(sessionId);
  }

  /**
   * Get session history for a user
   */
  async getSessionHistory(userId: string): Promise<SkillSession[]> {
    const allSessions = await storage.getSkillSessionsByUser(userId);
    
    return allSessions
      .filter(session => 
        session.status === 'completed' || session.status === 'cancelled'
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Check for scheduling conflicts
   */
  async checkSessionConflicts(
    userId: string, 
    startTime: Date, 
    endTime: Date, 
    excludeSessionId?: string
  ): Promise<boolean> {
    const userSessions = await storage.getSkillSessionsByUser(userId);
    
    return userSessions.some(session => {
      // Skip the session we're excluding (for updates)
      if (excludeSessionId && session.id === excludeSessionId) {
        return false;
      }
      
      // Only check active sessions
      if (session.status === 'cancelled' || session.status === 'completed') {
        return false;
      }
      
      const sessionStart = new Date(session.scheduledStart);
      const sessionEnd = new Date(session.scheduledEnd);
      
      // Check for time overlap
      return (startTime < sessionEnd && endTime > sessionStart);
    });
  }

  /**
   * Validate session data
   */
  validateSessionData(sessionData: Partial<InsertSkillSession>): void {
    if (!sessionData.teacherId || !sessionData.studentId) {
      throw new Error('Both teacher and student IDs are required');
    }

    if (sessionData.teacherId === sessionData.studentId) {
      throw new Error('Teacher and student cannot be the same person');
    }

    if (!sessionData.scheduledStart || !sessionData.scheduledEnd) {
      throw new Error('Both start and end times are required');
    }

    const startTime = new Date(sessionData.scheduledStart);
    const endTime = new Date(sessionData.scheduledEnd);
    const now = new Date();

    if (startTime <= now) {
      throw new Error('Session cannot be scheduled in the past');
    }

    if (endTime <= startTime) {
      throw new Error('End time must be after start time');
    }

    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    if (durationMinutes < 15) {
      throw new Error('Session must be at least 15 minutes long');
    }

    if (durationMinutes > 240) {
      throw new Error('Session cannot be longer than 4 hours');
    }

    if (!sessionData.creditsAmount || sessionData.creditsAmount <= 0) {
      throw new Error('Credits amount must be positive');
    }
  }

  /**
   * Create a video room (Twilio integration)
   * This is a simplified implementation - in production, this would integrate with Twilio Video API
   */
  private async createVideoRoom(sessionId: string): Promise<string> {
    // In a real implementation, this would:
    // 1. Create a Twilio Video Room
    // 2. Configure room settings (recording, participant limits, etc.)
    // 3. Return the actual room SID
    
    // For now, we'll generate a unique room ID
    const roomId = `session_${sessionId}_${Date.now()}`;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return roomId;
  }

  /**
   * Generate video access token (Twilio integration)
   * This is a simplified implementation - in production, this would generate actual Twilio access tokens
   */
  private async generateVideoToken(roomId: string, sessionId: string): Promise<string> {
    // In a real implementation, this would:
    // 1. Generate a Twilio Access Token
    // 2. Add Video Grant with room name
    // 3. Set appropriate identity and TTL
    // 4. Return the JWT token
    
    // For now, we'll generate a mock token
    const token = `mock_token_${roomId}_${sessionId}_${Date.now()}`;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return token;
  }
}

// Export singleton instance
export const sessionService = new SessionService();