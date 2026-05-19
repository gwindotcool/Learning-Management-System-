const mongoose = require('mongoose');

const mentorshipSchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mentee: {
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
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'declined'],
      default: 'pending',
      index: true,
    },
    mentorshipGoals: [String],
    focusAreas: [String],
    startDate: Date,
    endDate: Date,
    sessionCount: { type: Number, default: 0 },
    totalSessionMinutes: { type: Number, default: 0 },
    lastSessionAt: Date,
    menteeProgress: { type: Number, default: 0 }, // 0-100%
    mentorFeedback: String,
    menteeFeedback: String,
    rating: { type: Number, min: 1, max: 5 },
    sessionSchedule: {
      frequency: String, // 'weekly', 'bi-weekly', etc.
      preferredDays: [String],
      preferredTime: String,
    },
  },
  {
    timestamps: true,
  }
);

mentorshipSchema.index({ mentor: 1, status: 1 });
mentorshipSchema.index({ mentee: 1, status: 1 });
mentorshipSchema.index({ course: 1, status: 1 });
// Prevent duplicate active mentorships between same mentor and mentee
mentorshipSchema.index(
  { mentor: 1, mentee: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'active'] } }
  }
);

module.exports = mongoose.model('Mentorship', mentorshipSchema);
