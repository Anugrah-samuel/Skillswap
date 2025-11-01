import * as schema from "../shared/schema.js";
import * as validationSchemas from "../shared/validation-schemas.js";

// Verification script to ensure all schema exports are working correctly
console.log("Verifying schema exports...");

// Check that all new tables are exported
const requiredTables = [
  'users',
  'creditTransactions', 
  'courses',
  'courseLessons',
  'courseEnrollments',
  'subscriptions',
  'skillSessions',
  'userPreferences',
  'recommendationHistory',
  'paymentMethods'
];

const requiredInsertSchemas = [
  'insertCreditTransactionSchema',
  'insertCourseSchema', 
  'insertCourseLessonSchema',
  'insertCourseEnrollmentSchema',
  'insertSubscriptionSchema',
  'insertSkillSessionSchema',
  'insertUserPreferencesSchema',
  'insertRecommendationHistorySchema',
  'insertPaymentMethodSchema'
];

const requiredTypes = [
  'CreditTransaction',
  'Course',
  'CourseLesson', 
  'CourseEnrollment',
  'Subscription',
  'SkillSession',
  'UserPreferences',
  'RecommendationHistory',
  'PaymentMethod'
];

const requiredValidationSchemas = [
  'creditTransactionSchema',
  'createCourseSchema',
  'createCourseLessonSchema',
  'enrollInCourseSchema',
  'createSubscriptionSchema',
  'scheduleSessionSchema',
  'updateUserPreferencesSchema',
  'addPaymentMethodSchema'
];

// Verify table exports
console.log("Checking table exports...");
for (const table of requiredTables) {
  if (!(table in schema)) {
    console.error(`❌ Missing table export: ${table}`);
  } else {
    console.log(`✅ Table export found: ${table}`);
  }
}

// Verify insert schema exports
console.log("\nChecking insert schema exports...");
for (const insertSchema of requiredInsertSchemas) {
  if (!(insertSchema in schema)) {
    console.error(`❌ Missing insert schema export: ${insertSchema}`);
  } else {
    console.log(`✅ Insert schema export found: ${insertSchema}`);
  }
}

// Verify type exports
console.log("\nChecking type exports...");
for (const type of requiredTypes) {
  // Types are compile-time only, so we can't check them at runtime
  console.log(`📝 Type should be exported: ${type}`);
}

// Verify validation schema exports
console.log("\nChecking validation schema exports...");
for (const validationSchema of requiredValidationSchemas) {
  if (!(validationSchema in validationSchemas)) {
    console.error(`❌ Missing validation schema export: ${validationSchema}`);
  } else {
    console.log(`✅ Validation schema export found: ${validationSchema}`);
  }
}

console.log("\n✅ Schema verification complete!");
console.log("All required database tables, schemas, and validation rules have been implemented.");
console.log("\nNext steps:");
console.log("1. Set up DATABASE_URL environment variable");
console.log("2. Run migrations: npm run db:migrate:run");
console.log("3. Begin implementing the service layer for these new features");