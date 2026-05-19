// ─────────────────────────────────────────────────────────────────────────────
// course.routes.js
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const courseRouter = express.Router();
const c = require('../controllers/course.controller');
const { protect, restrictTo, optionalAuth } = require('../middlewares/auth.middleware');
const { uploadThumbnail, uploadVideo } = require('../middlewares/upload.middleware');

// Public discovery
courseRouter.get('/', optionalAuth, c.getCourses);
courseRouter.get('/featured', c.getFeaturedCourses);
courseRouter.get('/trending', c.getTrendingCourses);
courseRouter.get('/:courseId', optionalAuth, c.getCourse);

// Instructor course management (nested under courses)
courseRouter.post('/my-courses', protect, restrictTo('instructor', 'admin'), c.createCourse);
courseRouter.get('/my-courses', protect, restrictTo('instructor', 'admin'), c.getInstructorCourses);
courseRouter.put('/my-courses/:courseId', protect, restrictTo('instructor', 'admin'), c.updateCourse);
courseRouter.delete('/my-courses/:courseId', protect, restrictTo('instructor', 'admin'), c.deleteCourse);
courseRouter.post('/my-courses/:courseId/submit', protect, restrictTo('instructor', 'admin'), c.submitCourse);
courseRouter.post('/my-courses/:courseId/thumbnail', protect, restrictTo('instructor', 'admin'), uploadThumbnail, c.uploadThumbnail);

// Admin approval
courseRouter.get('/admin/all', protect, restrictTo('admin'), c.adminGetCourses);
courseRouter.post('/admin/:courseId/approve', protect, restrictTo('admin'), c.approveCourse);
courseRouter.post('/admin/:courseId/reject', protect, restrictTo('admin'), c.rejectCourse);

module.exports = courseRouter;
