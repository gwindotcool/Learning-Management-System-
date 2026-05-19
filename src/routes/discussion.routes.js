const express = require('express');
const { protect } = require('../middlewares/auth.middleware');
const discussionController = require('../controllers/discussion.controller');

const router = express.Router({ mergeParams: true });

/**
 * Discussion Forum Routes
 * Endpoints for course discussions, Q&A, and collaborative learning
 */

// Public routes
router.get('/courses/:courseId/discussions', discussionController.getThreads);
router.get('/discussions/:threadId', discussionController.getThread);
router.get('/courses/:courseId/discussions/search', discussionController.searchThreads);

// Protected routes (authenticated users)
router.post('/courses/:courseId/discussions', protect, discussionController.createThread);
router.post('/discussions/:threadId/replies', protect, discussionController.createReply);
router.get('/discussions/:threadId/replies', discussionController.getReplies);

// Voting
router.post('/replies/:replyId/vote', protect, discussionController.voteReply);

// Thread management
router.patch('/discussions/:threadId/pin', protect, discussionController.pinThread);
router.patch('/discussions/:threadId/resolve', protect, discussionController.markAsAnswer);
router.delete('/discussions/:threadId', protect, discussionController.deleteThread);

// Reply management
router.patch('/replies/:replyId/answer/:threadId', protect, discussionController.markAsAnswer);

module.exports = router;
