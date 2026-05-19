const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      index: true,
    },
    leaderboardType: {
      type: String,
      enum: ['global', 'course', 'monthly', 'weekly', 'cohort'],
      default: 'global',
      index: true,
    },
    rank: { type: Number, index: true },
    totalXp: { type: Number, default: 0, index: true },
    totalPoints: { type: Number, default: 0 },
    completedCourses: { type: Number, default: 0 },
    perfectQuizzes: { type: Number, default: 0 },
    helpfulReviews: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActivityAt: Date,
    cohortId: mongoose.Schema.Types.ObjectId, // For cohort-specific leaderboards
  },
  {
    timestamps: true,
  }
);

leaderboardSchema.index({ leaderboardType: 1, totalXp: -1 });
leaderboardSchema.index({ course: 1, totalXp: -1 });
leaderboardSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
