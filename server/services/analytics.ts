import { 
  type User,
  type SkillSession,
  type Course,
  type CourseEnrollment,
  type CreditTransaction,
  type Review
} from "@shared/schema";
import { storage } from "../storage";

export interface UserAnalytics {
  userId: string;
  totalSessionsCompleted: number;
  totalSessionsTaught: number;
  skillPoints: number;
  creditBalance: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  averageRating: number;
  totalReviews: number;
  coursesCreated: number;
  coursesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  badges: string[];
  joinedDate: Date;
  lastActiveDate: Date;
}

export interface SkillAnalytics {
  skillId: string;
  skillTitle: string;
  proficiencyLevel: number; // 0-100
  sessionsAsTeacher: number;
  sessionsAsStudent: number;
  averageTeachingRating: number;
  totalTeachingHours: number;
  totalLearningHours: number;
  creditsEarned: number;
  lastPracticed: Date;
  improvementRate: number; // Progress over time
}

export interface TeachingAnalytics {
  userId: string;
  totalStudents: number;
  totalTeachingHours: number;
  averageRating: number;
  totalEarnings: number;
  coursesCreated: number;
  courseEnrollments: number;
  studentSatisfactionRate: number;
  repeatStudentRate: number;
  topSkills: Array<{
    skillId: string;
    skillTitle: string;
    sessionsCount: number;
    averageRating: number;
  }>;
}

export interface LearningStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  streakStartDate: Date;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  criteria: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface AnalyticsServiceInterface {
  getUserAnalytics(userId: string): Promise<UserAnalytics>;
  getSkillAnalytics(userId: string, skillId?: string): Promise<SkillAnalytics[]>;
  getTeachingAnalytics(userId: string): Promise<TeachingAnalytics>;
  calculateSkillProficiency(userId: string, skillId: string): Promise<number>;
  updateLearningStreak(userId: string): Promise<LearningStreak>;
  checkAndAwardBadges(userId: string): Promise<string[]>;
  getAvailableBadges(): Promise<Badge[]>;
  getUserBadges(userId: string): Promise<Badge[]>;
  calculateTeachingEffectiveness(userId: string): Promise<number>;
  getActivitySummary(userId: string, days?: number): Promise<any>;
}

export class AnalyticsService implements AnalyticsServiceInterface {

  /**
   * Get comprehensive user analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get credit transactions for earnings/spending analysis
    const transactions = await storage.getCreditTransactionsByUser(userId);
    const totalCreditsEarned = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCreditsSpent = Math.abs(transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));

    // Get courses created and completed
    const createdCourses = await storage.getCoursesByCreator(userId);
    const enrollments = await storage.getCourseEnrollmentsByUser(userId);
    const completedCourses = enrollments.filter(e => e.progress === 100).length;

    // Calculate learning streak
    const streak = await this.updateLearningStreak(userId);

    // Get last activity date from sessions
    const sessions = await storage.getSkillSessionsByUser(userId);
    const lastActiveDate = sessions.length > 0 
      ? new Date(Math.max(...sessions.map(s => s.createdAt.getTime())))
      : user.createdAt;

    return {
      userId,
      totalSessionsCompleted: user.totalSessionsCompleted,
      totalSessionsTaught: user.totalSessionsTaught,
      skillPoints: user.skillPoints,
      creditBalance: user.creditBalance,
      totalCreditsEarned,
      totalCreditsSpent,
      averageRating: user.rating || 0,
      totalReviews: user.totalReviews || 0,
      coursesCreated: createdCourses.length,
      coursesCompleted: completedCourses,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      badges: user.badges,
      joinedDate: user.createdAt,
      lastActiveDate
    };
  }

  /**
   * Get skill-specific analytics for a user
   */
  async getSkillAnalytics(userId: string, skillId?: string): Promise<SkillAnalytics[]> {
    const userSkills = await storage.getSkillsByUser(userId);
    const sessions = await storage.getSkillSessionsByUser(userId);
    const reviews = await storage.getReviewsByUser(userId);

    const skillAnalytics: SkillAnalytics[] = [];

    for (const skill of userSkills) {
      // Skip if specific skill requested and this isn't it
      if (skillId && skill.id !== skillId) {
        continue;
      }

      const skillSessions = sessions.filter(s => s.skillId === skill.id);
      const teachingSessions = skillSessions.filter(s => s.teacherId === userId && s.status === 'completed');
      const learningSessions = skillSessions.filter(s => s.studentId === userId && s.status === 'completed');

      // Calculate teaching rating for this skill (use overall user rating as proxy)
      // Since reviews aren't linked to specific sessions, we use the user's overall rating
      const currentUser = await storage.getUser(userId);
      const averageTeachingRating = teachingSessions.length > 0 && currentUser ? (currentUser.rating || 0) / 10 : 0;

      // Calculate total hours
      const totalTeachingHours = teachingSessions.reduce((sum, s) => {
        if (s.actualStart && s.actualEnd) {
          return sum + (s.actualEnd.getTime() - s.actualStart.getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);

      const totalLearningHours = learningSessions.reduce((sum, s) => {
        if (s.actualStart && s.actualEnd) {
          return sum + (s.actualEnd.getTime() - s.actualStart.getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);

      // Calculate credits earned from teaching this skill
      const creditsEarned = teachingSessions.reduce((sum, s) => sum + s.creditsAmount, 0);

      // Get last practice date
      const lastPracticed = skillSessions.length > 0
        ? new Date(Math.max(...skillSessions.map(s => s.createdAt.getTime())))
        : skill.createdAt;

      // Calculate proficiency and improvement rate
      const proficiencyLevel = await this.calculateSkillProficiency(userId, skill.id);
      const improvementRate = await this.calculateImprovementRate(userId, skill.id);

      skillAnalytics.push({
        skillId: skill.id,
        skillTitle: skill.title,
        proficiencyLevel,
        sessionsAsTeacher: teachingSessions.length,
        sessionsAsStudent: learningSessions.length,
        averageTeachingRating,
        totalTeachingHours,
        totalLearningHours,
        creditsEarned,
        lastPracticed,
        improvementRate
      });
    }

    return skillAnalytics;
  }

  /**
   * Get teaching effectiveness analytics
   */
  async getTeachingAnalytics(userId: string): Promise<TeachingAnalytics> {
    const sessions = await storage.getSkillSessionsByUser(userId);
    const teachingSessions = sessions.filter(s => s.teacherId === userId && s.status === 'completed');
    const courses = await storage.getCoursesByCreator(userId);
    const reviews = await storage.getReviewsByUser(userId);

    // Get unique students
    const uniqueStudents = new Set(teachingSessions.map(s => s.studentId));
    const totalStudents = uniqueStudents.size;

    // Calculate total teaching hours
    const totalTeachingHours = teachingSessions.reduce((sum, s) => {
      if (s.actualStart && s.actualEnd) {
        return sum + (s.actualEnd.getTime() - s.actualStart.getTime()) / (1000 * 60 * 60);
      }
      return sum;
    }, 0);

    // Calculate average rating from user's overall rating
    // Since reviews aren't linked to specific sessions, we use the user's overall rating
    const currentUser = await storage.getUser(userId);
    const averageRating = teachingSessions.length > 0 && currentUser ? (currentUser.rating || 0) / 10 : 0;

    // Calculate total earnings from teaching
    const totalEarnings = teachingSessions.reduce((sum, s) => sum + s.creditsAmount, 0);

    // Get course enrollments
    const enrollments = await storage.getAllCourseEnrollments();
    const courseEnrollments = enrollments.filter(e => 
      courses.some(c => c.id === e.courseId)
    ).length;

    // Calculate student satisfaction rate based on overall rating
    const studentSatisfactionRate = averageRating >= 4 ? 100 : (averageRating / 4) * 100;

    // Calculate repeat student rate
    const studentSessionCounts = new Map<string, number>();
    teachingSessions.forEach(s => {
      const count = studentSessionCounts.get(s.studentId) || 0;
      studentSessionCounts.set(s.studentId, count + 1);
    });
    const repeatStudents = Array.from(studentSessionCounts.values()).filter(count => count > 1).length;
    const repeatStudentRate = totalStudents > 0 ? (repeatStudents / totalStudents) * 100 : 0;

    // Get top skills by session count and rating
    const skillStats = new Map<string, { count: number; ratings: number[]; skillTitle: string }>();
    
    for (const session of teachingSessions) {
      const skill = await storage.getSkill(session.skillId);
      if (skill) {
        const stats = skillStats.get(session.skillId) || { 
          count: 0, 
          ratings: [], 
          skillTitle: skill.title 
        };
        stats.count++;
        
        // Use overall user rating as proxy for session ratings
        const currentUser = await storage.getUser(userId);
        if (currentUser && currentUser.rating) {
          stats.ratings.push(currentUser.rating / 10);
        }
        
        skillStats.set(session.skillId, stats);
      }
    }

    const topSkills = Array.from(skillStats.entries())
      .map(([skillId, stats]) => ({
        skillId,
        skillTitle: stats.skillTitle,
        sessionsCount: stats.count,
        averageRating: stats.ratings.length > 0 
          ? stats.ratings.reduce((sum, r) => sum + r, 0) / stats.ratings.length 
          : 0
      }))
      .sort((a, b) => b.sessionsCount - a.sessionsCount)
      .slice(0, 5);

    return {
      userId,
      totalStudents,
      totalTeachingHours,
      averageRating,
      totalEarnings,
      coursesCreated: courses.length,
      courseEnrollments,
      studentSatisfactionRate,
      repeatStudentRate,
      topSkills
    };
  }

  /**
   * Calculate skill proficiency based on various factors
   */
  async calculateSkillProficiency(userId: string, skillId: string): Promise<number> {
    const sessions = await storage.getSkillSessionsByUser(userId);
    const skillSessions = sessions.filter(s => s.skillId === skillId && s.status === 'completed');
    
    const teachingSessions = skillSessions.filter(s => s.teacherId === userId);
    const learningSessions = skillSessions.filter(s => s.studentId === userId);
    
    // Base proficiency factors
    let proficiency = 0;
    
    // Teaching experience (higher weight)
    proficiency += Math.min(teachingSessions.length * 15, 60);
    
    // Learning experience
    proficiency += Math.min(learningSessions.length * 8, 30);
    
    // Reviews and ratings (if user has been teaching this skill)
    if (teachingSessions.length > 0) {
      const user = await storage.getUser(userId);
      if (user && user.rating) {
        const avgRating = user.rating / 10; // Convert from stored format (rating * 10)
        proficiency += (avgRating / 5) * 10; // Max 10 points from ratings
      }
    }
    
    // Recency bonus (activity in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSessions = skillSessions.filter(s => s.createdAt > thirtyDaysAgo);
    if (recentSessions.length > 0) {
      proficiency += Math.min(recentSessions.length * 2, 10);
    }
    
    return Math.min(Math.round(proficiency), 100);
  }

  /**
   * Update and calculate learning streak
   */
  async updateLearningStreak(userId: string): Promise<LearningStreak> {
    const sessions = await storage.getSkillSessionsByUser(userId);
    const completedSessions = sessions
      .filter(s => s.status === 'completed')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (completedSessions.length === 0) {
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: new Date(),
        streakStartDate: new Date()
      };
    }

    // Calculate streaks based on consecutive days with activity
    const activityDates = new Set<string>();
    completedSessions.forEach(session => {
      const dateStr = session.createdAt.toISOString().split('T')[0];
      activityDates.add(dateStr);
    });

    const sortedDates = Array.from(activityDates).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;
    let streakStartDate = new Date(sortedDates[0]);

    // Calculate current streak (from today backwards)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (activityDates.has(today) || activityDates.has(yesterday)) {
      currentStreak = 1;
      let checkDate = activityDates.has(today) ? today : yesterday;
      let currentDate = new Date(checkDate);
      
      while (true) {
        currentDate.setDate(currentDate.getDate() - 1);
        const prevDateStr = currentDate.toISOString().split('T')[0];
        if (activityDates.has(prevDateStr)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    const lastActivityDate = new Date(sortedDates[sortedDates.length - 1]);

    return {
      userId,
      currentStreak,
      longestStreak,
      lastActivityDate,
      streakStartDate
    };
  }

  /**
   * Check and award badges based on user achievements
   */
  async checkAndAwardBadges(userId: string): Promise<string[]> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const analytics = await this.getUserAnalytics(userId);
    const teachingAnalytics = await this.getTeachingAnalytics(userId);
    const newBadges: string[] = [];

    // Define badge criteria and check each one
    const badgeCriteria = [
      {
        id: 'first_session',
        name: 'First Steps',
        check: () => analytics.totalSessionsCompleted >= 1
      },
      {
        id: 'session_master',
        name: 'Session Master',
        check: () => analytics.totalSessionsCompleted >= 50
      },
      {
        id: 'teacher_novice',
        name: 'Teaching Novice',
        check: () => analytics.totalSessionsTaught >= 5
      },
      {
        id: 'teacher_expert',
        name: 'Teaching Expert',
        check: () => analytics.totalSessionsTaught >= 25
      },
      {
        id: 'highly_rated',
        name: 'Highly Rated',
        check: () => teachingAnalytics.averageRating >= 4.5 && analytics.totalReviews >= 10
      },
      {
        id: 'streak_warrior',
        name: 'Streak Warrior',
        check: () => analytics.currentStreak >= 7
      },
      {
        id: 'streak_legend',
        name: 'Streak Legend',
        check: () => analytics.longestStreak >= 30
      },
      {
        id: 'course_creator',
        name: 'Course Creator',
        check: () => analytics.coursesCreated >= 1
      },
      {
        id: 'prolific_creator',
        name: 'Prolific Creator',
        check: () => analytics.coursesCreated >= 5
      },
      {
        id: 'lifelong_learner',
        name: 'Lifelong Learner',
        check: () => analytics.coursesCompleted >= 10
      },
      {
        id: 'credit_earner',
        name: 'Credit Earner',
        check: () => analytics.totalCreditsEarned >= 100
      },
      {
        id: 'skill_points_master',
        name: 'Skill Points Master',
        check: () => analytics.skillPoints >= 500
      }
    ];

    // Check each badge and award if criteria met and not already owned
    for (const badge of badgeCriteria) {
      if (!user.badges.includes(badge.id) && badge.check()) {
        newBadges.push(badge.id);
      }
    }

    // Update user badges if new ones were earned
    if (newBadges.length > 0) {
      const updatedBadges = [...user.badges, ...newBadges];
      await storage.updateUser(userId, { badges: updatedBadges });
    }

    return newBadges;
  }

  /**
   * Get all available badges
   */
  async getAvailableBadges(): Promise<Badge[]> {
    return [
      {
        id: 'first_session',
        name: 'First Steps',
        description: 'Complete your first skill exchange session',
        criteria: 'Complete 1 session',
        rarity: 'common'
      },
      {
        id: 'session_master',
        name: 'Session Master',
        description: 'Complete 50 skill exchange sessions',
        criteria: 'Complete 50 sessions',
        rarity: 'rare'
      },
      {
        id: 'teacher_novice',
        name: 'Teaching Novice',
        description: 'Teach your first 5 sessions',
        criteria: 'Teach 5 sessions',
        rarity: 'common'
      },
      {
        id: 'teacher_expert',
        name: 'Teaching Expert',
        description: 'Teach 25 or more sessions',
        criteria: 'Teach 25 sessions',
        rarity: 'uncommon'
      },
      {
        id: 'highly_rated',
        name: 'Highly Rated',
        description: 'Maintain a 4.5+ star rating with at least 10 reviews',
        criteria: '4.5+ rating with 10+ reviews',
        rarity: 'epic'
      },
      {
        id: 'streak_warrior',
        name: 'Streak Warrior',
        description: 'Maintain a 7-day learning streak',
        criteria: '7-day streak',
        rarity: 'uncommon'
      },
      {
        id: 'streak_legend',
        name: 'Streak Legend',
        description: 'Achieve a 30-day learning streak',
        criteria: '30-day streak',
        rarity: 'legendary'
      },
      {
        id: 'course_creator',
        name: 'Course Creator',
        description: 'Create your first course',
        criteria: 'Create 1 course',
        rarity: 'common'
      },
      {
        id: 'prolific_creator',
        name: 'Prolific Creator',
        description: 'Create 5 or more courses',
        criteria: 'Create 5 courses',
        rarity: 'rare'
      },
      {
        id: 'lifelong_learner',
        name: 'Lifelong Learner',
        description: 'Complete 10 courses',
        criteria: 'Complete 10 courses',
        rarity: 'uncommon'
      },
      {
        id: 'credit_earner',
        name: 'Credit Earner',
        description: 'Earn 100 credits through teaching',
        criteria: 'Earn 100 credits',
        rarity: 'uncommon'
      },
      {
        id: 'skill_points_master',
        name: 'Skill Points Master',
        description: 'Accumulate 500 skill points',
        criteria: 'Earn 500 skill points',
        rarity: 'epic'
      }
    ];
  }

  /**
   * Get badges earned by a user
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const allBadges = await this.getAvailableBadges();
    return allBadges.filter(badge => user.badges.includes(badge.id));
  }

  /**
   * Calculate teaching effectiveness score
   */
  async calculateTeachingEffectiveness(userId: string): Promise<number> {
    const teachingAnalytics = await this.getTeachingAnalytics(userId);
    
    if (teachingAnalytics.totalStudents === 0) {
      return 0;
    }

    let effectiveness = 0;
    
    // Rating component (40% weight)
    effectiveness += (teachingAnalytics.averageRating / 5) * 40;
    
    // Student satisfaction component (30% weight)
    effectiveness += (teachingAnalytics.studentSatisfactionRate / 100) * 30;
    
    // Repeat student rate component (20% weight)
    effectiveness += (teachingAnalytics.repeatStudentRate / 100) * 20;
    
    // Experience component (10% weight)
    const experienceScore = Math.min(teachingAnalytics.totalStudents / 20, 1);
    effectiveness += experienceScore * 10;
    
    return Math.round(effectiveness);
  }

  /**
   * Get activity summary for a user over specified days
   */
  async getActivitySummary(userId: string, days: number = 30): Promise<any> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const sessions = await storage.getSkillSessionsByUser(userId);
    const recentSessions = sessions.filter(s => s.createdAt > cutoffDate);
    
    const transactions = await storage.getCreditTransactionsByUser(userId);
    const recentTransactions = transactions.filter(t => t.createdAt > cutoffDate);
    
    const enrollments = await storage.getCourseEnrollmentsByUser(userId);
    const recentEnrollments = enrollments.filter(e => e.createdAt > cutoffDate);

    return {
      period: `${days} days`,
      sessionsCompleted: recentSessions.filter(s => s.status === 'completed').length,
      sessionsScheduled: recentSessions.filter(s => s.status === 'scheduled').length,
      creditsEarned: recentTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0),
      creditsSpent: Math.abs(recentTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)),
      coursesEnrolled: recentEnrollments.length,
      activeDays: new Set(recentSessions.map(s => 
        s.createdAt.toISOString().split('T')[0]
      )).size
    };
  }

  /**
   * Calculate improvement rate for a skill over time
   */
  private async calculateImprovementRate(userId: string, skillId: string): Promise<number> {
    const sessions = await storage.getSkillSessionsByUser(userId);
    const skillSessions = sessions
      .filter(s => s.skillId === skillId && s.status === 'completed')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (skillSessions.length < 2) {
      return 0;
    }

    // Simple improvement calculation based on session frequency and recency
    const firstSession = skillSessions[0];
    const lastSession = skillSessions[skillSessions.length - 1];
    const daysBetween = (lastSession.createdAt.getTime() - firstSession.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysBetween === 0) {
      return 0;
    }

    const sessionsPerDay = skillSessions.length / daysBetween;
    const improvementRate = Math.min(sessionsPerDay * 10, 100); // Scale to 0-100
    
    return Math.round(improvementRate);
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();