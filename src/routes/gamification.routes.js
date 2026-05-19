const express = require('express');
const { protect, authorize } = require('../middlewares/auth.middleware');
const gamificationController = require('../controllers/gamification.controller');

const router = express.Router();

/**
 * Gamification Routes
 * Endpoints for achievements, leaderboards, streaks, and engagement
 */

// ─── Public Routes ────────────────────────────────────────────────────────
router.get('/achievements', gamificationController.getAllAchievements);
router.get('/achievements/trending', gamificationController.getTrendingAchievements);
router.get('/achievements/:achievementId', gamificationController.getAchievementDetails);

// Leaderboards (public viewing)
router.get('/leaderboards/global', gamificationController.getGlobalLeaderboard);
router.get('/leaderboards/courses/:courseId', gamificationController.getCourseLeaderboard);
router.get('/leaderboards/monthly', gamificationController.getTimedLeaderboard);
router.get('/leaderboards/weekly', gamificationController.getTimedLeaderboard);

// ─── Protected Routes ─────────────────────────────────────────────────────
router.get('/my/achievements', protect, gamificationController.getUserAchievements);
router.get('/my/leaderboard/position', protect, gamificationController.getLeaderboardPosition);
router.get('/my/leaderboard/near', protect, gamificationController.getLeaderboardNearUser);
router.get('/my/stats', protect, gamificationController.getUserStats);
router.get('/my/streak', protect, gamificationController.getUserStreak);

// Public user endpoints
router.get('/users/:userId/achievements', gamificationController.getUserAchievements);
router.get('/users/:userId/stats', gamificationController.getUserStats);
router.get('/users/:userId/leaderboard', gamificationController.getLeaderboardPosition);
router.get('/users/:userId/streak', gamificationController.getUserStreak);

// ─── Admin Routes ─────────────────────────────────────────────────────────
router.post('/achievements', protect, authorize('admin'), gamificationController.createAchievement);

module.exports = router;
