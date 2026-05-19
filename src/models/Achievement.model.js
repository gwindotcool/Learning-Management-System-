const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema(
  {
    // Achievement Definition
    name: {
      type: String,
      required: [true, 'Achievement name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    slug: { type: String, unique: true, index: true },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    icon: { url: String, publicId: String },
    category: {
      type: String,
      enum: ['course', 'engagement', 'social', 'learning-journey', 'milestone'],
      default: 'course',
      index: true,
    },
    rarity: {
      type: String,
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      default: 'common',
    },
    xpReward: { type: Number, default: 0, min: 0 },
    badgeColor: { type: String, default: '#FFD700' },

    // Trigger Conditions
    triggerType: {
      type: String,
      enum: [
        'course-completion',
        'perfect-quiz',
        'streak',
        'review',
        'help-others',
        'social-share',
        'course-enrollment',
        'assignments-completed',
        'speed-completion',
        'custom',
      ],
      required: true,
    },
    triggerCondition: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function(value) {
          // Validate structure based on triggerType
          if (this.triggerType === 'course-completion') {
            return value && typeof value.courseCount === 'number';
          }
          if (this.triggerType === 'streak') {
            return value && typeof value.days === 'number';
          }
          if (this.triggerType === 'perfect-quiz') {
            return value && value.courseId;
          }
          // For other trigger types, basic validation
          return true;
        },
        message: 'Invalid trigger condition structure for the specified trigger type'
      }
    }, // JSON config for condition logic
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // For course-specific achievements
    isActive: { type: Boolean, default: true },

    // Stats
    totalUnlocked: { type: Number, default: 0 },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'expert'],
      default: 'easy',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model('Achievement', achievementSchema);
