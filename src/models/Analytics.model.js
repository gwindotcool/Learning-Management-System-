const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    user: mongoose.Schema.Types.ObjectId,
    course: mongoose.Schema.Types.ObjectId,
    analyticsType: {
      type: String,
      enum: ['user', 'course', 'cohort', 'global', 'instructor'],
      index: true,
    },
    // Student Progress
    progressMetrics: {
      coursesStarted: { type: Number, default: 0 },
      coursesCompleted: { type: Number, default: 0 },
      totalLearningHours: { type: Number, default: 0 },
      averageCourseProgress: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
    },
    // Engagement
    engagementMetrics: {
      videosWatched: { type: Number, default: 0 },
      assignmentsSubmitted: { type: Number, default: 0 },
      quizzesAttempted: { type: Number, default: 0 },
      forumPostsCount: { type: Number, default: 0 },
      averageQuizScore: { type: Number, default: 0 },
    },
    // Performance
    performanceMetrics: {
      averageCompletionRate: { type: Number, default: 0 },
      averageAssignmentScore: { type: Number, default: 0 },
      certifications: { type: Number, default: 0 },
      skillsGained: [String],
    },
    // Behavioral
    behavioralMetrics: {
      loginFrequency: Number,
      lastActiveAt: Date,
      deviceTypes: [String],
      timeSpentDaily: Number,
      peakLearningHours: [String],
    },
    // Success Prediction
    successPrediction: {
      score: { type: Number, min: 0, max: 1 }, // 0-1 probability
      riskLevel: { type: String, enum: ['low', 'medium', 'high'] },
      predictedCompletionDate: Date,
      interventionNeeded: { type: Boolean, default: false },
      suggestedInterventions: [String],
    },
    // Period
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'daily',
      index: true,
    },
    dateRange: {
      start: Date,
      end: Date,
    },
  },
  {
    timestamps: true,
  }
);

analyticsSchema.index({ user: 1, createdAt: -1 });
analyticsSchema.index({ course: 1, createdAt: -1 });
analyticsSchema.index({ analyticsType: 1, createdAt: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
