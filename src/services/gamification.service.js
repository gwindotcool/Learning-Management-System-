const {
  Achievement, UserAchievement, Leaderboard,
} = require('../models/index');
const logger = require('../utils/logger');

/**
 * Gamification Service
 * Manages achievements, XP, points, and leaderboards
 */
class GamificationService {
  /**
   * Check and unlock achievements for a user
   */
  static async checkAndUnlockAchievements(userId, triggerType, metadata = {}) {
    try {
      const Achievement = require('mongoose').model('Achievement');
      const achievements = await Achievement.find({
        triggerType,
        isActive: true,
      });

      const unlockedAchievements = [];

      for (const achievement of achievements) {
        const hasUnlocked = await UserAchievement.findOne({
          user: userId,
          achievement: achievement._id,
        });

        if (!hasUnlocked && this.meetsCondition(achievement.triggerCondition, metadata)) {
          await UserAchievement.create({
            user: userId,
            achievement: achievement._id,
          });

          unlockedAchievements.push(achievement);

          // Award XP
          await this.addXP(userId, achievement.xpReward);

          logger.info(`Achievement unlocked for user ${userId}: ${achievement.name}`);
        }
      }

      return unlockedAchievements;
    } catch (error) {
      logger.error('Error checking achievements:', error);
      return [];
    }
  }

  /**
   * Check if user meets achievement condition
   */
  static meetsCondition(condition, metadata) {
    if (!condition) return false;

    const { operator, value, field } = condition;
    const actualValue = metadata[field];

    switch (operator) {
      case 'equals':
        return actualValue === value;
      case 'greater':
        return actualValue > value;
      case 'less':
        return actualValue < value;
      case 'gte':
        return actualValue >= value;
      case 'lte':
        return actualValue <= value;
      default:
        return false;
    }
  }

  /**
   * Add XP to user's leaderboard
   */
  static async addXP(userId, xpAmount, leaderboardType = 'global') {
    try {
      if (xpAmount <= 0) return;

      const leaderboard = await Leaderboard.findOneAndUpdate(
        { user: userId, leaderboardType },
        {
          $inc: { totalXp: xpAmount },
          lastActivityAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // Recalculate rank
      await this.recalculateLeaderboardRanks(leaderboardType);

      return leaderboard;
    } catch (error) {
      logger.error('Error adding XP:', error);
    }
  }

  /**
   * Add points for completing milestones
   */
  static async addPoints(userId, points, action) {
    try {
      const leaderboard = await Leaderboard.findOneAndUpdate(
        { user: userId, leaderboardType: 'global' },
        {
          $inc: { totalPoints: points },
          lastActivityAt: new Date(),
        },
        { upsert: true, new: true }
      );

      return leaderboard;
    } catch (error) {
      logger.error('Error adding points:', error);
    }
  }

  /**
   * Get user achievements
   */
  static async getUserAchievements(userId, limit = 50) {
    try {
      const achievements = await UserAchievement.find({ user: userId })
        .populate('achievement', 'name slug icon category rarity xpReward')
        .sort('-unlockedAt')
        .limit(limit)
        .lean();

      return achievements;
    } catch (error) {
      logger.error('Error getting user achievements:', error);
      throw error;
    }
  }

  /**
   * Get user leaderboard position
   */
  static async getUserLeaderboardPosition(userId, leaderboardType = 'global') {
    try {
      const userLeaderboard = await Leaderboard.findOne({
        user: userId,
        leaderboardType,
      }).lean();

      return userLeaderboard;
    } catch (error) {
      logger.error('Error getting user leaderboard position:', error);
      throw error;
    }
  }

  /**
   * Get top leaderboard entries
   */
  static async getTopLeaderboard(leaderboardType = 'global', limit = 100, courseId = null) {
    try {
      const query = { leaderboardType };
      if (courseId) query.course = courseId;

      const leaderboard = await Leaderboard.find(query)
        .populate('user', 'name avatar headline')
        .sort('-totalXp')
        .limit(limit)
        .lean();

      return leaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
    } catch (error) {
      logger.error('Error getting top leaderboard:', error);
      throw error;
    }
  }

  /**
   * Recalculate leaderboard ranks
   */
  static async recalculateLeaderboardRanks(leaderboardType = 'global') {
    try {
      const leaderboards = await Leaderboard.find({ leaderboardType })
        .sort('-totalXp');

      for (let i = 0; i < leaderboards.length; i++) {
        leaderboards[i].rank = i + 1;
        await leaderboards[i].save();
      }
    } catch (error) {
      logger.error('Error recalculating ranks:', error);
    }
  }

  /**
   * Update user streak
   */
  static async updateStreak(userId) {
    try {
      const leaderboard = await Leaderboard.findOne({
        user: userId,
        leaderboardType: 'global',
      });

      if (!leaderboard) {
        await Leaderboard.create({
          user: userId,
          leaderboardType: 'global',
          currentStreak: 1,
          longestStreak: 1,
        });
        return;
      }

      const lastActivity = leaderboard.lastActivityAt;
      const now = new Date();
      const daysDiff = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        leaderboard.currentStreak += 1;
        if (leaderboard.currentStreak > leaderboard.longestStreak) {
          leaderboard.longestStreak = leaderboard.currentStreak;
        }
      } else if (daysDiff > 1) {
        leaderboard.currentStreak = 1; // Reset streak
      }

      leaderboard.lastActivityAt = now;
      await leaderboard.save();
    } catch (error) {
      logger.error('Error updating streak:', error);
    }
  }

  /**
   * Get user stats for profile
   */
  static async getUserGamificationStats(userId) {
    try {
      const achievements = await UserAchievement.countDocuments({ user: userId });
      const leaderboard = await Leaderboard.findOne({
        user: userId,
        leaderboardType: 'global',
      }).lean();

      const userAchievements = await UserAchievement.find({ user: userId })
        .populate('achievement', 'xpReward')
        .lean();

      const totalXpEarned = userAchievements.reduce(
        (sum, ua) => sum + (ua.achievement?.xpReward || 0),
        0
      );

      return {
        totalAchievements: achievements,
        totalXp: leaderboard?.totalXp || 0,
        totalPoints: leaderboard?.totalPoints || 0,
        currentStreak: leaderboard?.currentStreak || 0,
        longestStreak: leaderboard?.longestStreak || 0,
        rank: leaderboard?.rank || 0,
      };
    } catch (error) {
      logger.error('Error getting gamification stats:', error);
      throw error;
    }
  }
}

module.exports = GamificationService;
