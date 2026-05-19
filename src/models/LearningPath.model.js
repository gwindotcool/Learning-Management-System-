const mongoose = require('mongoose');

const learningPathSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Learning path title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pathType: {
      type: String,
      enum: ['system-recommended', 'instructor-curated', 'user-custom'],
      default: 'user-custom',
      index: true,
    },
    targetAudience: String,
    courses: [
      {
        courseId: mongoose.Schema.Types.ObjectId,
        order: Number,
        isRequired: { type: Boolean, default: true },
        estimatedCompletionDays: Number,
      },
    ],
    skills: [String],
    estimatedTotalHours: { type: Number },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'beginner',
    },
    isPublic: { type: Boolean, default: true },
    enrolledUsers: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        enrolledAt: Date,
        progress: { type: Number, default: 0 }, // 0-100%
      },
    ],
    prerequisites: [mongoose.Schema.Types.ObjectId], // Other learning paths
    tags: [String],
    icon: { url: String, publicId: String },
    certificateTemplate: String,
  },
  {
    timestamps: true,
  }
);

learningPathSchema.index({ creator: 1 });
learningPathSchema.index({ pathType: 1 });
learningPathSchema.index({ isPublic: 1 });

module.exports = mongoose.model('LearningPath', learningPathSchema);
