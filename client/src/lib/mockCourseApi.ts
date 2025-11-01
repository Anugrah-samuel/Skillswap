// Mock API for Course Management
// This file provides all the necessary functions to manage courses in localStorage
// It can be easily replaced with real API calls later

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number; // Price in INR or credits
  currency: 'INR' | 'credits';
  duration: string; // e.g., "2 hours", "5 weeks"
  instructorId: string;
  instructorName: string;
  lessons: Lesson[];
  resources: Resource[];
  previewLessonId: string | null;
  createdAt: string;
  updatedAt: string;
  enrolledCount: number;
  rating: number;
  totalReviews: number;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl: string | null;
  notes: string;
  order: number;
  isPreview: boolean;
  createdAt: string;
}

export interface Resource {
  id: string;
  courseId: string;
  title: string;
  url: string;
  type: 'pdf' | 'zip' | 'other';
  createdAt: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
  progress: number; // 0-100
  completedAt: string | null;
}

export interface Purchase {
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: 'INR' | 'credits';
  purchasedAt: string;
  platformCommission: number; // 20% of the purchase price
  instructorEarnings: number; // 80% of the purchase price
}

// Helper function to get data from localStorage
const getFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// Helper function to save data to localStorage
const saveToLocalStorage = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Course API functions
export const mockCourseApi = {
  // Get all courses
  getCourses: (): Course[] => {
    return getFromLocalStorage<Course[]>('courses', []);
  },

  // Get course by ID
  getCourseById: (id: string): Course | undefined => {
    const courses = mockCourseApi.getCourses();
    return courses.find(course => course.id === id);
  },

  // Get courses by instructor
  getCoursesByInstructor: (instructorId: string): Course[] => {
    const courses = mockCourseApi.getCourses();
    return courses.filter(course => course.instructorId === instructorId);
  },

  // Create a new course
  createCourse: (course: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'enrolledCount' | 'rating' | 'totalReviews'>): Course => {
    const courses = mockCourseApi.getCourses();
    const newCourse: Course = {
      ...course,
      id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enrolledCount: 0,
      rating: 0,
      totalReviews: 0
    };
    courses.push(newCourse);
    saveToLocalStorage('courses', courses);
    return newCourse;
  },

  // Update a course
  updateCourse: (id: string, updates: Partial<Course>): Course | null => {
    const courses = mockCourseApi.getCourses();
    const index = courses.findIndex(course => course.id === id);
    if (index === -1) return null;
    
    const updatedCourse = {
      ...courses[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    courses[index] = updatedCourse;
    saveToLocalStorage('courses', courses);
    return updatedCourse;
  },

  // Delete a course
  deleteCourse: (id: string): boolean => {
    const courses = mockCourseApi.getCourses();
    const initialLength = courses.length;
    const filteredCourses = courses.filter(course => course.id !== id);
    saveToLocalStorage('courses', filteredCourses);
    return filteredCourses.length !== initialLength;
  },

  // Lesson API functions
  getLessonsByCourse: (courseId: string): Lesson[] => {
    const lessons = getFromLocalStorage<Lesson[]>('lessons', []);
    return lessons.filter(lesson => lesson.courseId === courseId);
  },

  // Create a new lesson
  createLesson: (lesson: Omit<Lesson, 'id' | 'createdAt'>): Lesson => {
    const lessons = getFromLocalStorage<Lesson[]>('lessons', []);
    const newLesson: Lesson = {
      ...lesson,
      id: `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    lessons.push(newLesson);
    saveToLocalStorage('lessons', lessons);
    return newLesson;
  },

  // Update a lesson
  updateLesson: (id: string, updates: Partial<Lesson>): Lesson | null => {
    const lessons = getFromLocalStorage<Lesson[]>('lessons', []);
    const index = lessons.findIndex(lesson => lesson.id === id);
    if (index === -1) return null;
    
    const updatedLesson = {
      ...lessons[index],
      ...updates
    };
    lessons[index] = updatedLesson;
    saveToLocalStorage('lessons', lessons);
    return updatedLesson;
  },

  // Delete a lesson
  deleteLesson: (id: string): boolean => {
    const lessons = getFromLocalStorage<Lesson[]>('lessons', []);
    const initialLength = lessons.length;
    const filteredLessons = lessons.filter(lesson => lesson.id !== id);
    saveToLocalStorage('lessons', filteredLessons);
    return filteredLessons.length !== initialLength;
  },

  // Resource API functions
  getResourcesByCourse: (courseId: string): Resource[] => {
    const resources = getFromLocalStorage<Resource[]>('resources', []);
    return resources.filter(resource => resource.courseId === courseId);
  },

  // Create a new resource
  createResource: (resource: Omit<Resource, 'id' | 'createdAt'>): Resource => {
    const resources = getFromLocalStorage<Resource[]>('resources', []);
    const newResource: Resource = {
      ...resource,
      id: `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    resources.push(newResource);
    saveToLocalStorage('resources', resources);
    return newResource;
  },

  // Delete a resource
  deleteResource: (id: string): boolean => {
    const resources = getFromLocalStorage<Resource[]>('resources', []);
    const initialLength = resources.length;
    const filteredResources = resources.filter(resource => resource.id !== id);
    saveToLocalStorage('resources', filteredResources);
    return filteredResources.length !== initialLength;
  },

  // Enrollment API functions
  getEnrollments: (): Enrollment[] => {
    return getFromLocalStorage<Enrollment[]>('enrollments', []);
  },

  getEnrollmentsByUser: (userId: string): Enrollment[] => {
    const enrollments = mockCourseApi.getEnrollments();
    return enrollments.filter(enrollment => enrollment.userId === userId);
  },

  getEnrollmentsByCourse: (courseId: string): Enrollment[] => {
    const enrollments = mockCourseApi.getEnrollments();
    return enrollments.filter(enrollment => enrollment.courseId === courseId);
  },

  // Enroll user in course
  enrollUser: (userId: string, courseId: string): Enrollment => {
    const enrollments = mockCourseApi.getEnrollments();
    const newEnrollment: Enrollment = {
      id: `enrollment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      courseId,
      enrolledAt: new Date().toISOString(),
      progress: 0,
      completedAt: null
    };
    enrollments.push(newEnrollment);
    saveToLocalStorage('enrollments', enrollments);
    
    // Update course enrolled count
    const course = mockCourseApi.getCourseById(courseId);
    if (course) {
      mockCourseApi.updateCourse(courseId, { enrolledCount: course.enrolledCount + 1 });
    }
    
    return newEnrollment;
  },

  // Update enrollment progress
  updateEnrollmentProgress: (enrollmentId: string, progress: number): Enrollment | null => {
    const enrollments = mockCourseApi.getEnrollments();
    const index = enrollments.findIndex(enrollment => enrollment.id === enrollmentId);
    if (index === -1) return null;
    
    const updatedEnrollment = {
      ...enrollments[index],
      progress,
      completedAt: progress === 100 ? new Date().toISOString() : enrollments[index].completedAt
    };
    enrollments[index] = updatedEnrollment;
    saveToLocalStorage('enrollments', enrollments);
    return updatedEnrollment;
  },

  // Purchase API functions
  getPurchases: (): Purchase[] => {
    return getFromLocalStorage<Purchase[]>('purchases', []);
  },

  getPurchasesByUser: (userId: string): Purchase[] => {
    const purchases = mockCourseApi.getPurchases();
    return purchases.filter(purchase => purchase.userId === userId);
  },

  getPurchasesByInstructor: (instructorId: string): Purchase[] => {
    // Get courses by instructor
    const courses = mockCourseApi.getCoursesByInstructor(instructorId);
    const courseIds = courses.map(course => course.id);
    
    // Get purchases for those courses
    const purchases = mockCourseApi.getPurchases();
    return purchases.filter(purchase => courseIds.includes(purchase.courseId));
  },

  // Purchase a course
  purchaseCourse: (userId: string, courseId: string, amount: number, currency: 'INR' | 'credits'): Purchase => {
    const purchases = mockCourseApi.getPurchases();
    const platformCommission = amount * 0.2; // 20% commission
    const instructorEarnings = amount * 0.8; // 80% to instructor
    
    const newPurchase: Purchase = {
      id: `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      courseId,
      amount,
      currency,
      purchasedAt: new Date().toISOString(),
      platformCommission,
      instructorEarnings
    };
    purchases.push(newPurchase);
    saveToLocalStorage('purchases', purchases);
    
    // Also enroll the user in the course
    mockCourseApi.enrollUser(userId, courseId);
    
    return newPurchase;
  },

  // Instructor earnings
  getInstructorEarnings: (instructorId: string): number => {
    const purchases = mockCourseApi.getPurchasesByInstructor(instructorId);
    return purchases.reduce((total, purchase) => total + purchase.instructorEarnings, 0);
  }
};

// Note: Sample data initialization removed - courses will be empty initially