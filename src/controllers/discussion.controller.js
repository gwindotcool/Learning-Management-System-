const { DiscussionForum, ForumReply } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const ApiFeatures = require('../utils/ApiFeatures');

/**
 * Discussion Forum Controller
 * Handles course discussions, Q&A, and peer learning
 */

// ─── POST: Create Discussion Thread ────────────────────────────────────────
exports.createThread = catchAsync(async (req, res) => {
  const { courseId, sectionId, lectureId, threadType, title, content, tags, isAnonymous } = req.body;

  if (!title || !content) {
    throw new AppError('Title and content are required', 400);
  }

  const thread = await DiscussionForum.create({
    course: courseId,
    section: sectionId,
    lecture: lectureId,
    threadType: threadType || 'discussion',
    title,
    content,
    author: isAnonymous ? null : req.user._id,
    tags: tags || [],
    isAnonymous: isAnonymous || false,
    lastActivityAt: new Date(),
  });

  res.status(201).json({
    success: true,
    message: 'Discussion thread created successfully',
    data: thread,
  });
});

// ─── GET: Get Course Discussions ───────────────────────────────────────────
exports.getThreads = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const { threadType, isResolved, sort, page = 1, limit = 20 } = req.query;

  const query = { course: courseId };
  if (threadType) query.threadType = threadType;
  if (isResolved !== undefined) query.isResolved = isResolved === 'true';

  const baseQuery = DiscussionForum.find(query)
    .populate('author', 'name avatar')
    .populate('replies');

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .limitFields();

  await features.paginate();
  const threads = await features.query;

  res.json({
    success: true,
    data: threads,
    meta: features.meta,
  });
});

// ─── GET: Get Single Thread ────────────────────────────────────────────────
exports.getThread = catchAsync(async (req, res) => {
  const thread = await DiscussionForum.findByIdAndUpdate(
    req.params.threadId,
    { $inc: { viewCount: 1 } },
    { new: true }
  )
    .populate('author', 'name avatar headline')
    .populate({
      path: 'replies',
      populate: { path: 'author', select: 'name avatar' },
    });

  if (!thread) throw new AppError('Thread not found', 404);

  res.json({ success: true, data: thread });
});

// ─── POST: Reply to Thread ─────────────────────────────────────────────────
exports.createReply = catchAsync(async (req, res) => {
  const { threadId } = req.params;
  const { content, isAnonymous } = req.body;

  if (!content) throw new AppError('Content is required', 400);

  const thread = await DiscussionForum.findById(threadId);
  if (!thread) throw new AppError('Thread not found', 404);

  const reply = await ForumReply.create({
    threadId,
    content,
    author: isAnonymous ? null : req.user._id,
    isAnonymous: isAnonymous || false,
  });

  // Update thread reply count
  thread.replyCount = (thread.replyCount || 0) + 1;
  thread.lastActivityAt = new Date();
  await thread.save();

  const populatedReply = await reply.populate('author', 'name avatar');

  res.status(201).json({
    success: true,
    message: 'Reply created successfully',
    data: populatedReply,
  });
});

// ─── GET: Get Thread Replies ──────────────────────────────────────────────
exports.getReplies = catchAsync(async (req, res) => {
  const { threadId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const replies = await ForumReply.find({ threadId })
    .populate('author', 'name avatar')
    .sort('-isMarkedAsAnswer -createdAt')
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await ForumReply.countDocuments({ threadId });

  res.json({
    success: true,
    data: replies,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
  });
});

// ─── PATCH: Mark Reply as Answer ───────────────────────────────────────────
exports.markAsAnswer = catchAsync(async (req, res) => {
  const { threadId, replyId } = req.params;

  const thread = await DiscussionForum.findById(threadId);
  if (!thread) throw new AppError('Thread not found', 404);

  // Only thread author can mark as answer
  if (thread.author.toString() !== req.user._id.toString()) {
    throw new AppError('Only thread author can mark answers', 403);
  }

  const reply = await ForumReply.findByIdAndUpdate(
    replyId,
    { isMarkedAsAnswer: true },
    { new: true }
  );

  if (!reply) throw new AppError('Reply not found', 404);

  // Mark thread as resolved
  thread.isResolved = true;
  await thread.save();

  res.json({
    success: true,
    message: 'Reply marked as answer',
    data: reply,
  });
});

// ─── PATCH: Upvote/Downvote ───────────────────────────────────────────────
exports.voteReply = catchAsync(async (req, res) => {
  const { replyId } = req.params;
  const { action } = req.body; // 'upvote' or 'downvote'

  const updateOps = {};
  if (action === 'upvote') updateOps.$inc = { upvotes: 1 };
  if (action === 'downvote') updateOps.$inc = { downvotes: 1 };

  const reply = await ForumReply.findByIdAndUpdate(replyId, updateOps, { new: true });

  if (!reply) throw new AppError('Reply not found', 404);

  res.json({ success: true, data: reply });
});

// ─── PATCH: Pin Thread ─────────────────────────────────────────────────────
exports.pinThread = catchAsync(async (req, res) => {
  const { threadId } = req.params;

  // Check authorization (instructor/admin only)
  const thread = await DiscussionForum.findByIdAndUpdate(
    threadId,
    { isPinned: true },
    { new: true }
  );

  if (!thread) throw new AppError('Thread not found', 404);

  res.json({ success: true, message: 'Thread pinned', data: thread });
});

// ─── DELETE: Delete Thread ────────────────────────────────────────────────
exports.deleteThread = catchAsync(async (req, res) => {
  const { threadId } = req.params;

  const thread = await DiscussionForum.findById(threadId);
  if (!thread) throw new AppError('Thread not found', 404);

  // Check authorization
  if (thread.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError('Not authorized to delete this thread', 403);
  }

  await DiscussionForum.findByIdAndDelete(threadId);
  await ForumReply.deleteMany({ threadId });

  res.json({ success: true, message: 'Thread deleted successfully' });
});

// ─── GET: Search Threads ──────────────────────────────────────────────────
exports.searchThreads = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const { q, threadType, page = 1, limit = 20 } = req.query;

  if (!q) throw new AppError('Search query is required', 400);

  const query = {
    course: courseId,
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { content: { $regex: q, $options: 'i' } },
      { tags: { $in: [new RegExp(q, 'i')] } },
    ],
  };

  if (threadType) query.threadType = threadType;

  const threads = await DiscussionForum.find(query)
    .populate('author', 'name avatar')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await DiscussionForum.countDocuments(query);

  res.json({
    success: true,
    data: threads,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
  });
});
