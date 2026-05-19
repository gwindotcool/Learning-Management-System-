const mongoose = require('mongoose');

const userAchievementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    achievement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Achievement',
      required: true,
    },
    unlockedAt: {
      type: Date,
      default: Date.now,
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'friends-only'],
      default: 'public',
    },
    isFavorite: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

userAchievementSchema.index({ user: 1, achievement: 1 }, { unique: true });
userAchievementSchema.index({ unlockedAt: -1 });

module.exports = mongoose.model('UserAchievement', userAchievementSchema);
