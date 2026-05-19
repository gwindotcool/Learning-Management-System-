const express = require('express');
const router = express.Router({ mergeParams: true });
const ctrl = require('../controllers/review.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

router.get('/courses/:courseId/reviews', ctrl.getCourseReviews);
router.post('/courses/:courseId/reviews', protect,
  [body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'), body('comment').optional().isLength({ max: 2000 })],
  validate, ctrl.createReview);
router.put('/courses/:courseId/reviews/:reviewId', protect, ctrl.updateReview);
router.delete('/courses/:courseId/reviews/:reviewId', protect, ctrl.deleteReview);
router.post('/courses/:courseId/reviews/:reviewId/helpful', protect, ctrl.markHelpful);
router.post('/instructor/courses/:courseId/reviews/:reviewId/respond', protect, restrictTo('instructor', 'admin'),
  [body('response').notEmpty().isLength({ max: 2000 })], validate, ctrl.respondToReview);
router.post('/courses/:courseId/reviews/:reviewId/report', protect,
  [body('reason').notEmpty()], validate, ctrl.reportReview);
router.get('/admin/reviews/reported', protect, restrictTo('admin'), ctrl.getReportedReviews);
router.delete('/admin/reviews/:reviewId', protect, restrictTo('admin'), ctrl.adminDeleteReview);

module.exports = router;
