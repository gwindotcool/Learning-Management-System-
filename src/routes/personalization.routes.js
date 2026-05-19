const express = require('express');
const { protect, authorize } = require('../middlewares/auth.middleware');
const personalizationController = require('../controllers/personalization.controller');

const router = express.Router();

/**
 * Personalization & Analytics Routes
 * Endpoints for recommendations, learning paths, and advanced analytics
 */

// ─── Public Routes ────────────────────────────────────────────────────────
router.get('/learning-paths', personalizationController.discoverLearningPaths);
router.get('/learning-paths/:pathId', personalizationController.getLearningPath);

// ─── Protected Routes ─────────────────────────────────────────────────────
router.get('/recommendations', protect, personalizationController.getRecommendations);
router.post('/recommendations/track/:courseId', protect, personalizationController.trackRecommendationEngagement);
router.get('/recommendations/path', protect, personalizationController.getLearningPathRecommendations);

// Analytics
router.get('/analytics', protect, personalizationController.getUserAnalytics);
router.post('/analytics/recalculate', protect, personalizationController.recalculateUserAnalytics);
router.get('/analytics/insights', protect, personalizationController.getLearningInsights);

// Learning Paths
router.get('/my/learning-paths', protect, personalizationController.getUserLearningPaths);
router.post('/learning-paths', protect, personalizationController.createLearningPath);
router.post('/learning-paths/:pathId/enroll', protect, personalizationController.enrollLearningPath);
router.patch('/learning-paths/:pathId/progress', protect, personalizationController.updatePathProgress);

// ─── Public User Analytics ────────────────────────────────────────────────
router.get('/analytics/:userId', personalizationController.getUserAnalytics);

// ─── Instructor Routes ────────────────────────────────────────────────────
router.get('/cohort/:cohortId/analytics', protect, authorize('instructor', 'admin'), personalizationController.getCohortAnalytics);

// ─── Admin Routes ─────────────────────────────────────────────────────────
router.post('/recommendations/generate', protect, authorize('admin'), personalizationController.generateRecommendations);

module.exports = router;
