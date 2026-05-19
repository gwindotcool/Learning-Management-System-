const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Session title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    sessionType: {
      type: String,
      enum: ['office-hours', 'live-lecture', 'q-and-a', 'workshop', 'group-study', 'code-review'],
      default: 'live-lecture',
    },
    host: {
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
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    startedAt: Date,
    endedAt: Date,
    duration: { type: Number }, // in minutes
    maxParticipants: { type: Number, default: null }, // null = unlimited
    currentParticipants: [
      {
        user: mongoose.Schema.Types.ObjectId,
        joinedAt: Date,
        leftAt: Date,
      },
    ],
    recordingUrl: String,
    recordingPublicId: String,
    isRecorded: { type: Boolean, default: false },
    meetingLink: String, // Zoom/Google Meet URL
    status: {
      type: String,
      enum: ['scheduled', 'live', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    topic: String,
    tags: [String],
    resources: [
      {
        title: String,
        url: String,
        type: String,
      },
    ],
    participantCount: { type: Number, default: 0 },
    isMandatory: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

liveSessionSchema.index({ host: 1, scheduledAt: -1 });
liveSessionSchema.index({ course: 1, scheduledAt: -1 });
liveSessionSchema.index({ status: 1, scheduledAt: -1 });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
