const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/curriculum.controller');
const { protect, restrictTo, optionalAuth } = require('../middlewares/auth.middleware');
const { uploadVideo, uploadAttachment } = require('../middlewares/upload.middleware');

// Sections (public read)
router.get('/courses/:courseId/sections', ctrl.getSections);
router.post('/instructor/courses/:courseId/sections', protect, restrictTo('instructor', 'admin'), ctrl.addSection);
router.put('/instructor/courses/:courseId/sections/:sectionId', protect, restrictTo('instructor', 'admin'), ctrl.updateSection);
router.delete('/instructor/courses/:courseId/sections/:sectionId', protect, restrictTo('instructor', 'admin'), ctrl.deleteSection);
router.put('/instructor/courses/:courseId/sections/reorder', protect, restrictTo('instructor', 'admin'), ctrl.reorderSections);

// Lectures
router.post('/instructor/sections/:sectionId/lectures', protect, restrictTo('instructor', 'admin'), ctrl.createLecture);
router.get('/sections/:sectionId/lectures/:lectureId', optionalAuth, ctrl.getLecture);
router.put('/instructor/sections/:sectionId/lectures/:lectureId', protect, restrictTo('instructor', 'admin'), ctrl.updateLecture);
router.delete('/instructor/sections/:sectionId/lectures/:lectureId', protect, restrictTo('instructor', 'admin'), ctrl.deleteLecture);
router.put('/instructor/sections/:sectionId/lectures/reorder', protect, restrictTo('instructor', 'admin'), ctrl.reorderLectures);

// Video
router.post('/instructor/lectures/:lectureId/video', protect, restrictTo('instructor', 'admin'), uploadVideo, ctrl.uploadLectureVideo);
router.get('/instructor/lectures/:lectureId/video/status', protect, restrictTo('instructor', 'admin'), ctrl.getLectureVideoStatus);

// Attachments
router.post('/instructor/lectures/:lectureId/attachment', protect, restrictTo('instructor', 'admin'), uploadAttachment, ctrl.uploadAttachment);
router.delete('/instructor/lectures/:lectureId/attachment/:attachmentId', protect, restrictTo('instructor', 'admin'), ctrl.deleteAttachment);

module.exports = router;
