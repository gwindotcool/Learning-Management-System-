const {
  Achievement, UserAchievement, Leaderboard,
} = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const GamificationService = require('../services/gamification.service');

/**
 * Gamification Controller
 * Manages achievements, leaderboards, and engagement
 */

// ─── GET: User Achievements ──────────────────────────────────────────────
exports.getUserAchievements = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user._id;
  const { limit = 50 } = req.query;

  const achievements = await GamificationService.getUserAchievements(userId, parseInt(limit));

  res.json({
    success: true,
    data: achievements,
    count: achievements.length,
  });
});

// ─── GET: All Achievements (Public Catalog) ──────────────────────────────
exports.getAllAchievements = catchAsync(async (req, res) => {
  const { category, rarity, limit = 100, page = 1 } = req.query;

  const query = { isActive: true };
  if (category) query.category = category;
  if (rarity) query.rarity = rarity;

  const achievements = await Achievement.find(query)
    .sort('-difficulty')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Achievement.countDocuments(query);

  res.json({
    success: true,
    data: achievements,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
  });
});

// ─── GET: User Leaderboard Position ─────────────────────────────────────
exports.getLeaderboardPosition = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user._id;
  const { leaderboardType = 'global', courseId } = req.query;

  const query = { user: userId, leaderboardType };
  if (courseId) query.course = courseId;

  const position = await Leaderboard.findOne(query)
    .populate('user', 'name avatar')
    .lean();

  if (!position) {
    return res.json({
      success: true,
      data: {
        rank: null,
        totalXp: 0,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
      },
    });
  }

  res.json({ success: true, data: position });
});

// ─── GET: Global Leaderboard ────────────────────────────────────────────
exports.getGlobalLeaderboard = catchAsync(async (req, res) => {
  const { limit = 100, page = 1, leaderboardType = 'global', courseId } = req.query;

  const leaderboard = await GamificationService.getTopLeaderboard(
    leaderboardType,
    parseInt(limit),
    courseId
  );

  const totalUsers = await Leaderboard.countDocuments({
    leaderboardType,
    ...(courseId && { course: courseId }),
  });

  res.json({
    success: true,
    data: leaderboard,
    meta: {
      total: totalUsers,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(totalUsers / limit),
    },
  });
});

// ─── GET: Leaderboard Near User ──────────────────────────────────────────
exports.getLeaderboardNearUser = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { range = 5, leaderboardType = 'global' } = req.query;

  const userPosition = await Leaderboard.findOne({
    user: userId,
    leaderboardType,
  });

  if (!userPosition) {
    throw new AppError('User not found in leaderboard', 404);
  }

  const startRank = Math.max(1, userPosition.rank - range);
  const endRank = userPosition.rank + range;

  const nearbyUsers = await Leaderboard.find({
    leaderboardType,
    rank: { $gte: startRank, $lte: endRank },
  })
    .populate('user', 'name avatar')
    .sort('rank');

  res.json({
    success: true,
    data: {
      userPosition,
      nearbyUsers,
    },
  });
});

// ─── GET: User Gamification Stats ──────────────────────────────────────
exports.getUserStats = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user._id;

  const stats = await GamificationService.getUserGamificationStats(userId);

  res.json({ success: true, data: stats });
});

// ─── GET: Achievement Details ───────────────────────────────────────────
exports.getAchievementDetails = catchAsync(async (req, res) => {
  const { achievementId } = req.params;

  const achievement = await Achievement.findById(achievementId);
  if (!achievement) throw new AppError('Achievement not found', 404);

  const unlockedCount = await UserAchievement.countDocuments({ achievement: achievementId });

  res.json({
    success: true,
    data: {
      ...achievement.toObject(),
      unlockedCount,
    },
  });
});

// ─── POST: Create Achievement (Admin) ────────────────────────────────────
exports.createAchievement = catchAsync(async (req, res) => {
  const {
    name, description, category, rarity, xpReward,
    triggerType, triggerCondition, difficulty,
  } = req.body;

  const achievement = await Achievement.create({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description,
    category: category || 'course',
    rarity: rarity || 'common',
    xpReward: xpReward || 0,
    triggerType,
    triggerCondition,
    difficulty: difficulty || 'easy',
    isActive: true,
  });

  res.status(201).json({
    success: true,
    message: 'Achievement created successfully',
    data: achievement,
  });
});

// ─── GET: Course Leaderboard ────────────────────────────────────────────
exports.getCourseLeaderboard = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const { limit = 50, page = 1 } = req.query;

  const leaderboard = await Leaderboard.find({ course: courseId, leaderboardType: 'course' })
    .populate('user', 'name avatar')
    .sort('-totalXp')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  const total = await Leaderboard.countDocuments({ course: courseId, leaderboardType: 'course' });

  res.json({
    success: true,
    data: leaderboard.map((entry, index) => ({
      ...entry,
      rank: (page - 1) * limit + index + 1,
    })),
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
  });
});

// ─── GET: Monthly/Weekly Leaderboard ────────────────────────────────────
exports.getTimedLeaderboard = catchAsync(async (req, res) => {
  const { period = 'monthly', limit = 50 } = req.query;

  const leaderboardType = period === 'weekly' ? 'weekly' : 'monthly';

  const leaderboard = await GamificationService.getTopLeaderboard(leaderboardType, parseInt(limit));

  res.json({
    success: true,
    period,
    data: leaderboard,
  });
});

// ─── GET: Trending Achievements ────────────────────────────────────────
exports.getTrendingAchievements = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;

  const achievements = await Achievement.find({ isActive: true })
    .sort('-totalUnlocked')
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: achievements,
  });
});

// ─── GET: User Streak ──────────────────────────────────────────────────
exports.getUserStreak = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user._id;

  const leaderboard = await Leaderboard.findOne({
    user: userId,
    leaderboardType: 'global',
  }).lean();

  res.json({
    success: true,
    data: {
      currentStreak: leaderboard?.currentStreak || 0,
      longestStreak: leaderboard?.longestStreak || 0,
      lastActivityAt: leaderboard?.lastActivityAt,
    },
  });
});
