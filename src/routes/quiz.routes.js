// ─── quiz.routes.js ───────────────────────────────────────────────────────────
const express = require('express');
const quizRouter = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/quiz.controller');
const { uploadAttachment } = require('../middlewares/upload.middleware');

quizRouter.post('/instructor/lectures/:lectureId/quiz', protect, restrictTo('instructor', 'admin'), ctrl.createQuiz);
quizRouter.put('/instructor/quizzes/:quizId', protect, restrictTo('instructor', 'admin'), ctrl.updateQuiz);
quizRouter.post('/instructor/quizzes/:quizId/questions', protect, restrictTo('instructor', 'admin'), ctrl.addQuestions);
quizRouter.put('/instructor/quizzes/:quizId/questions/:questionId', protect, restrictTo('instructor', 'admin'), ctrl.updateQuestion);
quizRouter.delete('/instructor/quizzes/:quizId/questions/:questionId', protect, restrictTo('instructor', 'admin'), ctrl.deleteQuestion);
quizRouter.post('/quizzes/:quizId/attempt', protect, ctrl.submitAttempt);
quizRouter.get('/quizzes/:quizId/attempts', protect, ctrl.getAttempts);
quizRouter.get('/quizzes/:quizId/attempts/:attemptId', protect, ctrl.getAttemptDetail);

quizRouter.post('/instructor/lectures/:lectureId/assignment', protect, restrictTo('instructor', 'admin'), ctrl.createAssignment);
quizRouter.post('/assignments/:assignmentId/submit', protect, uploadAttachment, ctrl.submitAssignment);
quizRouter.get('/instructor/assignments/:assignmentId/submissions', protect, restrictTo('instructor', 'admin'), ctrl.getSubmissions);
quizRouter.put('/instructor/assignments/:assignmentId/submissions/:submissionId/grade', protect, restrictTo('instructor', 'admin'), ctrl.gradeSubmission);

module.exports = quizRouter;
