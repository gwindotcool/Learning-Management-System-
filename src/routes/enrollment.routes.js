// ─────────────────────────────────────────────────────────────────────────────
// enrollment.routes.js
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/enrollment.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

router.post('/', protect, [body('courseId').notEmpty()], validate, ctrl.enroll);
router.get('/me', protect, ctrl.getMyEnrollments);
router.get('/me/:courseId', protect, ctrl.checkEnrollment);
router.get('/instructor/courses/:courseId/students', protect, restrictTo('instructor', 'admin'), ctrl.getCourseStudents);

// Progress
router.get('/progress/:courseId', protect, ctrl.getCourseProgress);
router.post('/progress/:courseId/lectures/:lectureId/complete', protect, ctrl.markLectureComplete);
router.delete('/progress/:courseId/lectures/:lectureId/complete', protect, ctrl.unmarkLectureComplete);
router.put('/progress/:courseId/lectures/:lectureId/position', protect,
  [body('positionSeconds').isNumeric()], validate, ctrl.saveVideoPosition);
router.get('/progress/:courseId/certificate/eligibility', protect, ctrl.checkEligibility ||
  require('../controllers/certificate.controller').checkEligibility);

module.exports = router;
