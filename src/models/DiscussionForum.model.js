const mongoose = require('mongoose');

const discussionForumSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      index: true,
    },
    lecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lecture',
      index: true,
    },
    threadType: {
      type: String,
      enum: ['question', 'discussion', 'announcement', 'resource'],
      default: 'discussion',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Thread title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      maxlength: [10000, 'Content cannot exceed 10000 characters'],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tags: [String],
    attachments: [
      {
        url: String,
        filename: String,
        size: Number,
      },
    ],
    isResolved: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    isAnonymous: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    lastActivityAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

discussionForumSchema.virtual('replies', {
  ref: 'ForumReply',
  localField: '_id',
  foreignField: 'threadId',
});

discussionForumSchema.index({ course: 1, createdAt: -1 });
discussionForumSchema.index({ author: 1, createdAt: -1 });
discussionForumSchema.index({ isPinned: -1, createdAt: -1 });
discussionForumSchema.index({ isResolved: 1 });

module.exports = mongoose.model('DiscussionForum', discussionForumSchema);
