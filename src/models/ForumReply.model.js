const mongoose = require('mongoose');

const forumReplySchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiscussionForum',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Reply content is required'],
      maxlength: [10000, 'Content cannot exceed 10000 characters'],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attachments: [
      {
        url: String,
        filename: String,
        size: Number,
      },
    ],
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    isMarkedAsAnswer: { type: Boolean, default: false },
    isAnonymous: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    editedAt: Date,
    parentReplyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumReply', index: true }, // For nested replies
  },
  {
    timestamps: true,
  }
);

forumReplySchema.index({ threadId: 1, createdAt: -1 });
forumReplySchema.index({ author: 1, createdAt: -1 });
forumReplySchema.index({ isMarkedAsAnswer: 1 });

module.exports = mongoose.model('ForumReply', forumReplySchema);
