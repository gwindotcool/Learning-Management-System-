const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analytics.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

router.get('/instructor/analytics/overview', protect, restrictTo('instructor', 'admin'), ctrl.instructorOverview);
router.get('/instructor/analytics/revenue', protect, restrictTo('instructor', 'admin'), ctrl.instructorRevenue);
router.get('/instructor/analytics/enrollments', protect, restrictTo('instructor', 'admin'), ctrl.instructorEnrollments);
router.get('/instructor/analytics/courses/:courseId', protect, restrictTo('instructor', 'admin'), ctrl.instructorCourseAnalytics);
router.get('/instructor/analytics/reviews', protect, restrictTo('instructor', 'admin'), ctrl.instructorReviewTrends);
router.get('/admin/analytics/overview', protect, restrictTo('admin'), ctrl.adminOverview);
router.get('/admin/analytics/revenue', protect, restrictTo('admin'), ctrl.adminRevenue);
router.get('/admin/analytics/users', protect, restrictTo('admin'), ctrl.adminUserGrowth);
router.get('/admin/analytics/courses', protect, restrictTo('admin'), ctrl.adminCoursePerformance);
router.post('/admin/analytics/reports/export', protect, restrictTo('admin'), ctrl.exportReport);

module.exports = router;
