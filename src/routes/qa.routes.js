const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/qa.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

router.get('/courses/:courseId/questions', protect, ctrl.getCourseQuestions);
router.post('/courses/:courseId/questions', protect,
  [body('title').notEmpty().isLength({ max: 200 }), body('body').notEmpty().isLength({ max: 5000 })],
  validate, ctrl.postQuestion);
router.put('/questions/:questionId', protect, ctrl.updateQuestion);
router.delete('/questions/:questionId', protect, ctrl.deleteQuestion);
router.post('/questions/:questionId/answers', protect, [body('body').notEmpty().isLength({ max: 5000 })], validate, ctrl.postAnswer);
router.put('/questions/:questionId/answers/:answerId', protect, ctrl.updateAnswer);
router.delete('/questions/:questionId/answers/:answerId', protect, ctrl.deleteAnswer);
router.post('/questions/:questionId/answers/:answerId/upvote', protect, ctrl.upvoteAnswer);
router.post('/questions/:questionId/answers/:answerId/mark-correct', protect, restrictTo('instructor', 'admin'), ctrl.markAnswerCorrect);

module.exports = router;
