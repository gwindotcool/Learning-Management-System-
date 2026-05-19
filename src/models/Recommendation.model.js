const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    recommendationType: {
      type: String,
      enum: [
        'collaborative-filtering',
        'content-based',
        'trending',
        'popular',
        'skill-based',
        'instructor-recommended',
        'personalized',
        'career-path',
      ],
      default: 'personalized',
    },
    score: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    reason: String, // Why this course was recommended
    matchedSkills: [String],
    learningStyle: String, // visual, auditory, kinesthetic, reading/writing
    engagementScore: { type: Number, min: 0, max: 1 },
    isViewed: { type: Boolean, default: false },
    viewedAt: Date,
    isClicked: { type: Boolean, default: false },
    clickedAt: Date,
    isEnrolled: { type: Boolean, default: false },
    enrolledAt: Date,
    feedback: {
      isHelpful: Boolean,
      feedbackAt: Date,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  {
    timestamps: true,
  }
);

recommendationSchema.index({ user: 1, createdAt: -1 });
recommendationSchema.index({ user: 1, score: -1 });
recommendationSchema.index({ recommendationType: 1 });
recommendationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);
