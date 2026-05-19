const { Recommendation, Enrollment, Review, Course, User } = require('../models/index');
const logger = require('../utils/logger');

/**
 * AI-Powered Recommendation Engine
 * Implements collaborative filtering, content-based, and hybrid recommendations
 */
class RecommendationEngine {
  /**
   * Generate personalized recommendations for a user
   */
  static async generatePersonalizedRecommendations(userId, limit = 10) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Get user's enrolled courses
      const enrolledCourses = await Enrollment.find({ student: userId }).select('course');
      const enrolledCourseIds = enrolledCourses.map(e => e.course);

      // COLLABORATIVE FILTERING: Find similar users
      const similarUsers = await this.findSimilarUsers(userId, 5);
      const similarUserIds = similarUsers.map(u => u._id);

      // Get courses taken by similar users but not by current user
      const collaborativeRecommendations = await Enrollment.aggregate([
        { $match: { student: { $in: similarUserIds }, course: { $nin: enrolledCourseIds } } },
        {
          $group: {
            _id: '$course',
            enrollmentCount: { $sum: 1 },
            avgProgress: { $avg: '$completionPercentage' },
          },
        },
        { $sort: { enrollmentCount: -1 } },
        { $limit: limit * 2 },
      ]);

      // CONTENT-BASED: Find courses similar to user's completed courses
      const completedCourses = await Course.find({ _id: { $in: enrolledCourseIds } });
      const userCategories = [...new Set(completedCourses.map(c => c.category.toString()))];
      
      const contentBasedRecommendations = await Course.find({
        _id: { $nin: enrolledCourseIds },
        category: { $in: userCategories },
        status: 'published',
      })
        .select('_id title stats')
        .limit(limit * 2);

      // TRENDING: Popular courses in relevant categories
      const trendingRecommendations = await Course.find({
        _id: { $nin: enrolledCourseIds },
        category: { $in: userCategories },
        status: 'published',
      })
        .sort({ 'stats.totalStudents': -1 })
        .limit(limit);

      // Merge and score recommendations
      const recommendations = await this.scoreAndMergeRecommendations(
        userId,
        collaborativeRecommendations,
        contentBasedRecommendations,
        trendingRecommendations,
        limit
      );

      return recommendations;
    } catch (error) {
      logger.error('Error generating personalized recommendations:', error);
      throw error;
    }
  }

  /**
   * Find users with similar learning patterns
   */
  static async findSimilarUsers(userId, limit = 5) {
    try {
      // Get current user's enrolled courses and their categories
      const userEnrollments = await Enrollment.find({ student: userId }).select('course');
      const userCourseIds = userEnrollments.map(e => e.course);

      const userCourses = await Course.find({ _id: { $in: userCourseIds } }).select('category');
      const userCategories = [...new Set(userCourses.map(c => c.category.toString()))];

      // Find users with courses in similar categories
      const similarUsers = await Enrollment.aggregate([
        {
          $lookup: {
            from: 'courses',
            localField: 'course',
            foreignField: '_id',
            as: 'courseData',
          },
        },
        { $unwind: '$courseData' },
        {
          $match: {
            student: { $ne: userId },
            'courseData.category': { $in: userCategories.map(c => new (require('mongoose')).Types.ObjectId(c)) },
          },
        },
        {
          $group: {
            _id: '$student',
            sharedCourses: { $sum: 1 },
          },
        },
        { $sort: { sharedCourses: -1 } },
        { $limit: limit },
        { $project: { _id: 1 } },
      ]);

      return similarUsers.map(u => ({ _id: u._id }));
    } catch (error) {
      logger.error('Error finding similar users:', error);
      return [];
    }
  }

  /**
   * Score and merge recommendation sources
   */
  static async scoreAndMergeRecommendations(
    userId,
    collaborative,
    contentBased,
    trending,
    limit
  ) {
    try {
      const scoreMap = new Map();

      // Score collaborative recommendations
      collaborative.forEach((rec, index) => {
        const score = (1 - index / collaborative.length) * 0.4; // 40% weight
        scoreMap.set(rec._id.toString(), {
          courseId: rec._id,
          score,
          type: 'collaborative-filtering',
          sources: ['collaborative'],
        });
      });

      // Score content-based recommendations
      contentBased.forEach((course, index) => {
        const baseScore = (1 - index / contentBased.length) * 0.35; // 35% weight
        const engagementBonus = (course.stats?.averageRating || 0) / 5 * 0.05; // Engagement bonus
        const score = baseScore + engagementBonus;
        
        const existing = scoreMap.get(course._id.toString());
        if (existing) {
          existing.score += score;
          existing.sources.push('content-based');
          existing.type = 'personalized';
        } else {
          scoreMap.set(course._id.toString(), {
            courseId: course._id,
            score,
            type: 'content-based',
            sources: ['content-based'],
          });
        }
      });

      // Score trending recommendations
      trending.forEach((course, index) => {
        const score = (1 - index / trending.length) * 0.25; // 25% weight
        
        const existing = scoreMap.get(course._id.toString());
        if (existing) {
          existing.score += score;
          existing.sources.push('trending');
        } else {
          scoreMap.set(course._id.toString(), {
            courseId: course._id,
            score,
            type: 'trending',
            sources: ['trending'],
          });
        }
      });

      // Sort by score and take top N
      const recommendations = Array.from(scoreMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Save recommendations to DB
      for (const rec of recommendations) {
        await Recommendation.findOneAndUpdate(
          { user: userId, course: rec.courseId },
          {
            user: userId,
            course: rec.courseId,
            score: Math.min(rec.score, 1), // Normalize to 0-1
            recommendationType: rec.type,
            reason: `Recommended based on ${rec.sources.join(', ')}`,
          },
          { upsert: true, new: true }
        );
      }

      return recommendations;
    } catch (error) {
      logger.error('Error scoring and merging recommendations:', error);
      throw error;
    }
  }

  /**
   * Get recommendations for a user
   */
  static async getRecommendations(userId, limit = 10) {
    try {
      const recommendations = await Recommendation.find({ user: userId })
        .populate('course', 'title slug thumbnail price stats level')
        .sort('-score')
        .limit(limit)
        .lean();

      return recommendations;
    } catch (error) {
      logger.error('Error getting recommendations:', error);
      throw error;
    }
  }

  /**
   * Track recommendation engagement (click, enroll)
   */
  static async trackRecommendationEngagement(userId, courseId, action) {
    try {
      const updateData = {};
      const now = new Date();

      switch (action) {
        case 'view':
          updateData.isViewed = true;
          updateData.viewedAt = now;
          break;
        case 'click':
          updateData.isClicked = true;
          updateData.clickedAt = now;
          break;
        case 'enroll':
          updateData.isEnrolled = true;
          updateData.enrolledAt = now;
          break;
        case 'helpful':
          updateData.feedback = { isHelpful: true, feedbackAt: now };
          break;
      }

      await Recommendation.findOneAndUpdate(
        { user: userId, course: courseId },
        updateData,
        { upsert: true }
      );
    } catch (error) {
      logger.error('Error tracking recommendation engagement:', error);
    }
  }

  /**
   * Generate learning path recommendations
   */
  static async generateLearningPathRecommendations(userId) {
    try {
      const userEnrollments = await Enrollment.find({ student: userId }).select('course');
      const enrolledCourseIds = userEnrollments.map(e => e.course);

      const userCourses = await Course.find({ _id: { $in: enrolledCourseIds } });
      const userLevel = this.inferUserLevel(userCourses);
      const userCategories = [...new Set(userCourses.map(c => c.category))];

      // Recommend progression courses
      const progressionCourses = await Course.find({
        _id: { $nin: enrolledCourseIds },
        category: { $in: userCategories },
        status: 'published',
        level: this.getNextLevel(userLevel),
      }).limit(5);

      return progressionCourses;
    } catch (error) {
      logger.error('Error generating learning path recommendations:', error);
      throw error;
    }
  }

  /**
   * Infer user's learning level from completed courses
   */
  static inferUserLevel(courses) {
    if (courses.length === 0) return 'beginner';
    
    const levels = courses.map(c => c.level);
    const advancedCount = levels.filter(l => l === 'advanced').length;
    const intermediateCount = levels.filter(l => l === 'intermediate').length;

    if (advancedCount > courses.length * 0.5) return 'advanced';
    if (intermediateCount > courses.length * 0.5) return 'intermediate';
    return 'beginner';
  }

  /**
   * Get next learning level
   */
  static getNextLevel(currentLevel) {
    const levels = { beginner: 'intermediate', intermediate: 'advanced', advanced: 'advanced' };
    return levels[currentLevel] || 'intermediate';
  }
}

module.exports = RecommendationEngine;
