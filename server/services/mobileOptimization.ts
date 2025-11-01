import { storage } from '../storage';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SyncResponse {
  users?: any[];
  skills?: any[];
  matches?: any[];
  messages?: any[];
  notifications?: any[];
  lastSync: string;
  hasMore: boolean;
}

export class MobileOptimizationService {
  // Paginate any array of data
  static paginate<T>(data: T[], page: number, limit: number): PaginatedResponse<T> {
    const total = data.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedData = data.slice(offset, offset + limit);

    return {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Get optimized user profile for mobile
  static async getOptimizedUserProfile(userId: string): Promise<any> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Return only essential fields for mobile
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      rating: user.rating,
      totalReviews: user.totalReviews,
      creditBalance: user.creditBalance,
      subscriptionStatus: user.subscriptionStatus,
      badges: user.badges?.slice(0, 5) || [] // Limit badges for mobile
    };
  }

  // Get optimized skills list for mobile
  static async getOptimizedSkills(userId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<any>> {
    const skills = await storage.getSkillsByUser(userId);
    
    // Optimize skill data for mobile
    const optimizedSkills = skills.map(skill => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      level: skill.level,
      description: skill.description && skill.description.length > 100 
        ? skill.description.substring(0, 100) + '...' 
        : skill.description, // Truncate description
      isOffering: skill.isOffering,
      isLearning: skill.isLearning
    }));

    return this.paginate(optimizedSkills, page, limit);
  }

  // Get optimized matches for mobile
  static async getOptimizedMatches(userId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<any>> {
    const matches = await storage.getMatchesByUser(userId);
    
    // Optimize match data for mobile
    const optimizedMatches = await Promise.all(
      matches.map(async (match) => {
        const matchedUser = await storage.getUser(match.matchedUserId);
        const userSkill = await storage.getSkill(match.userSkillId);
        const matchedSkill = await storage.getSkill(match.matchedSkillId);

        return {
          id: match.id,
          status: match.status,
          createdAt: match.createdAt,
          matchedUser: matchedUser ? {
            id: matchedUser.id,
            username: matchedUser.username,
            fullName: matchedUser.fullName,
            avatarUrl: matchedUser.avatarUrl,
            rating: matchedUser.rating
          } : null,
          userSkill: userSkill ? {
            id: userSkill.id,
            name: userSkill.name,
            category: userSkill.category
          } : null,
          matchedSkill: matchedSkill ? {
            id: matchedSkill.id,
            name: matchedSkill.name,
            category: matchedSkill.category
          } : null
        };
      })
    );

    return this.paginate(optimizedMatches, page, limit);
  }

  // Get optimized conversations for mobile
  static async getOptimizedConversations(userId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<any>> {
    const conversations = await storage.getConversationsByUser(userId);
    
    // Optimize conversation data for mobile
    const optimizedConversations = conversations.map(conv => ({
      partnerId: conv.partnerId,
      partner: conv.partner ? {
        id: conv.partner.id,
        username: conv.partner.username,
        fullName: conv.partner.fullName,
        avatarUrl: conv.partner.avatarUrl
      } : null,
      lastMessage: {
        id: conv.lastMessage.id,
        content: conv.lastMessage.content.substring(0, 100) + (conv.lastMessage.content.length > 100 ? '...' : ''),
        createdAt: conv.lastMessage.createdAt,
        senderId: conv.lastMessage.senderId
      },
      unreadCount: conv.unreadCount
    }));

    return this.paginate(optimizedConversations, page, limit);
  }

  // Get optimized notifications for mobile
  static async getOptimizedNotifications(userId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<any>> {
    const notifications = await storage.getNotificationsByUser(userId);
    
    // Optimize notification data for mobile
    const optimizedNotifications = notifications.map(notification => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message.substring(0, 100) + (notification.message.length > 100 ? '...' : ''),
      read: notification.read,
      createdAt: notification.createdAt,
      relatedId: notification.relatedId
    }));

    return this.paginate(optimizedNotifications, page, limit);
  }

  // Sync data for offline support
  static async syncData(userId: string, lastSync: Date, entities: string[]): Promise<SyncResponse> {
    const response: SyncResponse = {
      lastSync: new Date().toISOString(),
      hasMore: false
    };

    // Sync users data
    if (entities.includes('users')) {
      const user = await this.getOptimizedUserProfile(userId);
      response.users = [user];
    }

    // Sync skills data
    if (entities.includes('skills')) {
      const skills = await storage.getSkillsByUser(userId);
      response.skills = skills.filter(skill => 
        skill.createdAt > lastSync || 
        (skill as any).updatedAt > lastSync
      ).map(skill => ({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        level: skill.level,
        isOffering: skill.isOffering,
        isLearning: skill.isLearning,
        updatedAt: (skill as any).updatedAt || skill.createdAt
      }));
    }

    // Sync matches data
    if (entities.includes('matches')) {
      const matches = await storage.getMatchesByUser(userId);
      response.matches = matches.filter(match => 
        match.createdAt > lastSync
      ).map(match => ({
        id: match.id,
        status: match.status,
        userSkillId: match.userSkillId,
        matchedSkillId: match.matchedSkillId,
        matchedUserId: match.matchedUserId,
        createdAt: match.createdAt
      }));
    }

    // Sync messages data
    if (entities.includes('messages')) {
      const conversations = await storage.getConversationsByUser(userId);
      const allMessages: any[] = [];
      
      for (const conv of conversations) {
        const messages = await storage.getMessagesBetweenUsers(userId, conv.partnerId);
        const recentMessages = messages.filter(msg => msg.createdAt > lastSync);
        allMessages.push(...recentMessages.map(msg => ({
          id: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          content: msg.content,
          read: msg.read,
          createdAt: msg.createdAt
        })));
      }
      
      response.messages = allMessages;
    }

    // Sync notifications data
    if (entities.includes('notifications')) {
      const notifications = await storage.getNotificationsByUser(userId);
      response.notifications = notifications.filter(notification => 
        notification.createdAt > lastSync
      ).map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt,
        relatedId: notification.relatedId
      }));
    }

    return response;
  }

  // Get mobile dashboard data
  static async getMobileDashboard(userId: string): Promise<any> {
    const [user, skills, matches, notifications] = await Promise.all([
      this.getOptimizedUserProfile(userId),
      storage.getSkillsByUser(userId),
      storage.getMatchesByUser(userId),
      storage.getNotificationsByUser(userId)
    ]);

    const unreadNotifications = notifications.filter(n => !n.read).length;
    const pendingMatches = matches.filter(m => m.status === 'pending').length;
    const activeSkills = skills.filter(s => s.isOffering || s.isLearning).length;

    return {
      user,
      stats: {
        activeSkills,
        pendingMatches,
        unreadNotifications,
        totalSkills: skills.length,
        totalMatches: matches.length
      },
      recentActivity: {
        recentMatches: matches.slice(0, 3).map(match => ({
          id: match.id,
          status: match.status,
          createdAt: match.createdAt
        })),
        recentNotifications: notifications.slice(0, 3).map(notification => ({
          id: notification.id,
          title: notification.title,
          type: notification.type,
          createdAt: notification.createdAt
        }))
      }
    };
  }

  // Search with mobile optimization
  static async mobileSearch(query: string, type: 'skills' | 'users' | 'courses', page: number = 1, limit: number = 20): Promise<PaginatedResponse<any>> {
    let results: any[] = [];

    switch (type) {
      case 'skills':
        // Get all skills and filter by query
        const allSkills = Array.from((storage as any).skills.values());
        results = allSkills.filter((skill: any) => 
          skill.name.toLowerCase().includes(query.toLowerCase()) ||
          skill.category.toLowerCase().includes(query.toLowerCase())
        ).map((skill: any) => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          level: skill.level
        }));
        break;

      case 'users':
        const allUsers = Array.from((storage as any).users.values());
        results = allUsers.filter((user: any) => 
          user.username.toLowerCase().includes(query.toLowerCase()) ||
          (user.fullName && user.fullName.toLowerCase().includes(query.toLowerCase()))
        ).map((user: any) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          rating: user.rating
        }));
        break;

      case 'courses':
        const allCourses = Array.from((storage as any).courses.values());
        results = allCourses.filter((course: any) => 
          course.title.toLowerCase().includes(query.toLowerCase()) ||
          course.description.toLowerCase().includes(query.toLowerCase())
        ).map((course: any) => ({
          id: course.id,
          title: course.title,
          description: course.description && course.description.length > 100 
            ? course.description.substring(0, 100) + '...' 
            : course.description,
          priceCredits: course.priceCredits,
          rating: course.rating
        }));
        break;
    }

    return this.paginate(results, page, limit);
  }
}