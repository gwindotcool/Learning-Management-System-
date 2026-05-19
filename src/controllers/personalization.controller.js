const { Recommendation, LearningPath, Analytics } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const RecommendationEngine = require('../services/recommendation.service');
const AnalyticsService = require('../services/analytics.service');

/**
 * Advanced Analytics & Personalization Controller
 */

// ─── GET: Personalized Recommendations ───────────────────────────────────
exports.getRecommendations = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;
  const userId = req.user._id;

  const recommendations = await RecommendationEngine.getRecommendations(userId, parseInt(limit));

  res.json({
    success: true,
    message: 'Personalized recommendations',
    data: recommendations,
  });
});

// ─── POST: Generate Recommendations (Admin/Cron) ─────────────────────────
exports.generateRecommendations = catchAsync(async (req, res) => {
  const { userId } = req.body;

  const recommendations = await RecommendationEngine.generatePersonalizedRecommendations(
    userId,
    10
  );

  res.json({
    success: true,
    message: 'Recommendations generated',
    count: recommendations.length,
    data: recommendations,
  });
});

// ─── POST: Track Recommendation Engagement ──────────────────────────────
exports.trackRecommendationEngagement = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const { action } = req.body; // 'view', 'click', 'enroll', 'helpful'
  const userId = req.user._id;

  // Validate action parameter
  const validActions = ['view', 'click', 'enroll', 'helpful'];
  if (!validActions.includes(action)) {
    throw new AppError('Invalid action. Must be one of: view, click, enroll, helpful', 400);
  }

  await RecommendationEngine.trackRecommendationEngagement(userId, courseId, action);

  res.json({
    success: true,
    message: `Recommendation ${action} tracked`,
  });
});

// ─── GET: Learning Path Recommendations ───────────────────────────────
exports.getLearningPathRecommendations = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const recommendations = await RecommendationEngine.generateLearningPathRecommendations(userId);

  res.json({
    success: true,
    message: 'Recommended learning path progression',
    data: recommendations,
  });
});

// ─── GET: User Learning Analytics ──────────────────────────────────────
exports.getUserAnalytics = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user._id;

  const analytics = await AnalyticsService.getAnalyticsDashboard(userId);

  if (!analytics) {
    // Calculate fresh analytics
    return res.json({
      success: true,
      data: null,
      message: 'No analytics data yet. Complete courses to generate insights.',
    });
  }

  res.json({
    success: true,
    data: analytics,
  });
});

// ─── POST: Recalculate User Analytics (Manual Trigger) ──────────────────
exports.recalculateUserAnalytics = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const analytics = await AnalyticsService.calculateUserAnalytics(userId);

  res.json({
    success: true,
    message: 'Analytics recalculated',
    data: analytics,
  });
});

// ─── GET: Learning Insights ────────────────────────────────────────────
exports.getLearningInsights = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const analytics = await AnalyticsService.getAnalyticsDashboard(userId);

  if (!analytics) throw new AppError('No analytics data available', 404);

  const insights = {
    strengths: [],
    areasForImprovement: [],
    recommendations: [],
  };

  // Analyze performance
  if (analytics.performanceMetrics.averageCompletionRate > 0.8) {
    insights.strengths.push('High course completion rate - Keep it up!');
  }

  if (analytics.engagementMetrics.averageQuizScore > 80) {
    insights.strengths.push('Excellent quiz performance - You master the material quickly');
  }

  if (analytics.progressMetrics.currentStreak > 7) {
    insights.strengths.push(`Amazing ${analytics.progressMetrics.currentStreak}-day learning streak!`);
  }

  if (analytics.successPrediction.riskLevel === 'high') {
    insights.areasForImprovement.push('Your progress suggests you might need additional support');
  }

  if (analytics.engagementMetrics.forumPostsCount < 3) {
    insights.recommendations.push('Engage with the community by posting in forums');
  }

  insights.recommendations.push('Review course material before quizzes');
  insights.recommendations.push('Join study groups for similar courses');

  res.json({
    success: true,
    data: {
      analytics,
      insights,
    },
  });
});

// ─── GET: Cohort Analytics (Instructor) ────────────────────────────────
exports.getCohortAnalytics = catchAsync(async (req, res) => {
  const { cohortId } = req.params;

  const cohortAnalytics = await AnalyticsService.calculateCohortAnalytics(cohortId);

  res.json({
    success: true,
    data: cohortAnalytics,
  });
});

// ─── POST: Create Learning Path ────────────────────────────────────────
exports.createLearningPath = catchAsync(async (req, res) => {
  const {
    title, description, courses, skills, difficulty, isPublic,
  } = req.body;

  const learningPath = await LearningPath.create({
    title,
    description,
    creator: req.user._id,
    pathType: 'user-custom',
    courses: courses || [],
    skills: skills || [],
    difficulty: difficulty || 'beginner',
    isPublic: isPublic ?? false,
  });

  res.status(201).json({
    success: true,
    message: 'Learning path created',
    data: learningPath,
  });
});

// ─── GET: Learning Path Details ────────────────────────────────────────
exports.getLearningPath = catchAsync(async (req, res) => {
  const { pathId } = req.params;

  const learningPath = await LearningPath.findById(pathId)
    .populate({
      path: 'courses.courseId',
      select: 'title slug thumbnail price level stats',
    })
    .populate('creator', 'name avatar');

  if (!learningPath) throw new AppError('Learning path not found', 404);

  res.json({
    success: true,
    data: learningPath,
  });
});

// ─── GET: Discover Learning Paths ──────────────────────────────────────
exports.discoverLearningPaths = catchAsync(async (req, res) => {
  const { difficulty, skill, limit = 20, page = 1 } = req.query;

  const query = { isPublic: true, pathType: ['system-recommended', 'instructor-curated'] };
  if (difficulty) query.difficulty = difficulty;
  if (skill) query.skills = { $in: [skill] };

  const paths = await LearningPath.find(query)
    .populate('creator', 'name avatar')
    .sort('-enrolledUsers.length')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await LearningPath.countDocuments(query);

  res.json({
    success: true,
    data: paths,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
  });
});

// ─── POST: Enroll in Learning Path ────────────────────────────────────
exports.enrollLearningPath = catchAsync(async (req, res) => {
  const { pathId } = req.params;
  const userId = req.user._id;

  const learningPath = await LearningPath.findById(pathId);
  if (!learningPath) throw new AppError('Learning path not found', 404);

  // Check if already enrolled
  const alreadyEnrolled = learningPath.enrolledUsers.some(eu => eu.userId.toString() === userId);
  if (alreadyEnrolled) throw new AppError('Already enrolled in this path', 400);

  learningPath.enrolledUsers.push({
    userId,
    enrolledAt: new Date(),
    progress: 0,
  });

  await learningPath.save();

  res.json({
    success: true,
    message: 'Enrolled in learning path',
    data: learningPath,
  });
});

// ─── GET: User Learning Paths ────────────────────────────────────────
exports.getUserLearningPaths = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const paths = await LearningPath.find({
    'enrolledUsers.userId': userId,
  })
    .populate({
      path: 'courses.courseId',
      select: 'title slug thumbnail stats level',
    })
    .lean();

  res.json({
    success: true,
    data: paths,
  });
});

// ─── PATCH: Update Learning Path Progress ────────────────────────────
exports.updatePathProgress = catchAsync(async (req, res) => {
  const { pathId } = req.params;
  const { progress } = req.body;
  const userId = req.user._id;

  const learningPath = await LearningPath.findById(pathId);
  if (!learningPath) throw new AppError('Learning path not found', 404);

  const enrollment = learningPath.enrolledUsers.find(eu => eu.userId.toString() === userId);
  if (!enrollment) throw new AppError('Not enrolled in this path', 400);

  enrollment.progress = Math.min(progress, 100);
  await learningPath.save();

  res.json({
    success: true,
    message: 'Path progress updated',
    data: learningPath,
  });
});
