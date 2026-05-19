const { Analytics } = require('../models/index');
const logger = require('../utils/logger');

/**
 * Advanced Analytics Service
 * Provides learning analytics, success prediction, and insights
 */
class AnalyticsService {
  /**
   * Record user activity for analytics
   */
  static async recordActivity(userId, activityType, metadata = {}) {
    try {
      // This would be called frequently, so batching/aggregation is important
      // In production, use a queue system (Bull/RabbitMQ)
      logger.debug(`Recording activity for user ${userId}: ${activityType}`, metadata);
      
      // Update daily analytics cache (not shown here, use Redis)
    } catch (error) {
      logger.error('Error recording activity:', error);
    }
  }

  /**
   * Calculate user learning analytics
   */
  static async calculateUserAnalytics(userId) {
    try {
      const Enrollment = require('mongoose').model('Enrollment');
      const QuizAttempt = require('mongoose').model('QuizAttempt');
      const Review = require('mongoose').model('Review');
      const Question = require('mongoose').model('Question');

      // Progress metrics
      const enrollments = await Enrollment.find({ student: userId });
      const completedCourses = enrollments.filter(e => e.isCompleted).length;
      const totalProgress = enrollments.reduce((sum, e) => sum + e.completionPercentage, 0) / (enrollments.length || 1);

      // Engagement metrics
      const quizAttempts = await QuizAttempt.countDocuments({ student: userId });
      const avgQuizScore = await QuizAttempt.aggregate([
        { $match: { student: userId } },
        { $group: { _id: null, avgScore: { $avg: '$score' } } },
      ]);

      const forumPosts = await Question.countDocuments({ student: userId });
      const reviews = await Review.countDocuments({ student: userId });

      // Performance metrics
      const certificateCount = enrollments.filter(e => e.certificateIssued).length;

      // Behavioral metrics
      const lastActivity = enrollments.reduce((latest, e) => {
        return new Date(e.lastAccessedAt) > new Date(latest) ? e.lastAccessedAt : latest;
      }, new Date(0));

      // Success prediction
      const successMetrics = await this.predictSuccess(userId, enrollments);

      const analytics = {
        user: userId,
        analyticsType: 'user',
        period: 'monthly',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        progressMetrics: {
          coursesStarted: enrollments.length,
          coursesCompleted: completedCourses,
          totalLearningHours: await this.calculateTotalLearningHours(userId),
          averageCourseProgress: totalProgress,
          currentStreak: await this.calculateStreak(userId),
        },
        engagementMetrics: {
          videosWatched: await this.countVideosWatched(userId),
          assignmentsSubmitted: await this.countAssignmentsSubmitted(userId),
          quizzesAttempted: quizAttempts,
          forumPostsCount: forumPosts,
          averageQuizScore: avgQuizScore[0]?.avgScore || 0,
        },
        performanceMetrics: {
          averageCompletionRate: totalProgress,
          averageAssignmentScore: await this.calculateAvgAssignmentScore(userId),
          certifications: certificateCount,
          skillsGained: await this.extractSkillsGained(userId),
        },
        behavioralMetrics: {
          loginFrequency: enrollments.length > 0 ? enrollments.length / 30 : 0,
          lastActiveAt: lastActivity,
          peakLearningHours: await this.identifyPeakHours(userId),
        },
        successPrediction: successMetrics,
      };

      // Save analytics
      await Analytics.create(analytics);
      return analytics;
    } catch (error) {
      logger.error('Error calculating user analytics:', error);
      throw error;
    }
  }

  /**
   * Predict student success
   */
  static async predictSuccess(userId, enrollments) {
    try {
      // Simple heuristic model - replace with ML model in production
      const completionRate = enrollments.filter(e => e.isCompleted).length / (enrollments.length || 1);
      const avgProgress = enrollments.reduce((sum, e) => sum + e.completionPercentage, 0) / (enrollments.length || 1);
      
      // Weighted score (0-1)
      const successScore = (completionRate * 0.6 + (avgProgress / 100) * 0.4);
      
      let riskLevel = 'low';
      let interventionNeeded = false;
      const suggestedInterventions = [];

      if (successScore < 0.3) {
        riskLevel = 'high';
        interventionNeeded = true;
        suggestedInterventions.push('Schedule mentoring session');
        suggestedInterventions.push('Review course prerequisites');
        suggestedInterventions.push('Connect with peer study group');
      } else if (successScore < 0.6) {
        riskLevel = 'medium';
        interventionNeeded = true;
        suggestedInterventions.push('Review course progress');
        suggestedInterventions.push('Consider instructor office hours');
      }

      return {
        score: successScore,
        riskLevel,
        predictedCompletionDate: new Date(Date.now() + (30 - avgProgress / 100 * 30) * 24 * 60 * 60 * 1000),
        interventionNeeded,
        suggestedInterventions,
      };
    } catch (error) {
      logger.error('Error predicting success:', error);
      return { score: 0.5, riskLevel: 'medium', interventionNeeded: false, suggestedInterventions: [] };
    }
  }

  /**
   * Calculate cohort analytics
   */
  static async calculateCohortAnalytics(cohortId) {
    try {
      const Enrollment = require('mongoose').model('Enrollment');
      const User = require('mongoose').model('User');

      // Get cohort users
      const users = await User.find({ cohortId }).select('_id');
      const userIds = users.map(u => u._id);

      // Calculate aggregated metrics
      const enrollments = await Enrollment.find({ student: { $in: userIds } });
      const avgCompletionRate = enrollments.length > 0
        ? enrollments.reduce((sum, e) => sum + e.completionPercentage, 0) / enrollments.length
        : 0;
      const completedCount = enrollments.filter(e => e.isCompleted).length;

      return {
        cohortId,
        totalStudents: userIds.length,
        averageCompletionRate: avgCompletionRate,
        completedCourses: completedCount,
        totalEnrollments: enrollments.length,
      };
    } catch (error) {
      logger.error('Error calculating cohort analytics:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  static async calculateTotalLearningHours(userId) {
    const Enrollment = require('mongoose').model('Enrollment');
    const enrollments = await Enrollment.find({ student: userId });
    // In production, calculate from video duration and completion time
    return enrollments.length * 5; // Placeholder
  }

  static async calculateStreak(userId) {
    const Leaderboard = require('mongoose').model('Leaderboard');
    const lb = await Leaderboard.findOne({ user: userId, leaderboardType: 'global' });
    return lb?.currentStreak || 0;
  }

  static async countVideosWatched(userId) {
    const Enrollment = require('mongoose').model('Enrollment');
    const enrollments = await Enrollment.find({ student: userId });
    return enrollments.reduce((sum, e) => sum + e.completedLectures.length, 0);
  }

  static async countAssignmentsSubmitted(userId) {
    const Submission = require('mongoose').model('Submission');
    return Submission.countDocuments({ student: userId });
  }

  static async calculateAvgAssignmentScore(userId) {
    const Submission = require('mongoose').model('Submission');
    const submissions = await Submission.aggregate([
      { $match: { student: userId } },
      { $group: { _id: null, avgGrade: { $avg: '$grade' } } },
    ]);
    return submissions[0]?.avgGrade || 0;
  }

  static async extractSkillsGained(userId) {
    // In production, map courses to skills
    return [];
  }

  static async identifyPeakHours(userId) {
    // Would require timestamp data from activity logs
    return ['14:00-16:00', '19:00-21:00']; // Placeholder
  }

  /**
   * Get analytics dashboard data
   */
  static async getAnalyticsDashboard(userId) {
    try {
      const latestAnalytics = await Analytics.findOne({ user: userId, analyticsType: 'user' })
        .sort('-createdAt')
        .lean();

      return latestAnalytics;
    } catch (error) {
      logger.error('Error getting analytics dashboard:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
