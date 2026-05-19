const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/media.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { uploadImage, uploadVideo, uploadCaption } = require('../middlewares/upload.middleware');
const { body, param } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

router.post('/upload/image', protect, uploadImage, ctrl.uploadImage);
router.post('/upload/video/initiate', protect, restrictTo('instructor', 'admin'),
  [body('filename').notEmpty(), body('size').isNumeric()], validate, ctrl.initiateVideoUpload);
router.put('/upload/video/:uploadId/part/:partNumber', protect, restrictTo('instructor', 'admin'),
  [param('uploadId').notEmpty(), param('partNumber').isInt({ min: 1 })], validate, uploadVideo, ctrl.uploadVideoPart);
router.post('/upload/video/:uploadId/complete', protect, restrictTo('instructor', 'admin'),
  [param('uploadId').notEmpty()], validate, ctrl.completeVideoUpload);
router.delete('/upload/video/:uploadId/abort', protect, restrictTo('instructor', 'admin'),
  [param('uploadId').notEmpty()], validate, ctrl.abortVideoUpload);
router.get('/video/:videoId/stream', protect, [param('videoId').notEmpty()], validate, ctrl.getStreamingUrl);
router.get('/video/:videoId/captions', protect, [param('videoId').notEmpty()], validate, ctrl.getCaptions);
router.post('/video/:videoId/captions', protect, restrictTo('instructor', 'admin'),
  [param('videoId').notEmpty()], validate, uploadCaption, ctrl.uploadCaptions);

module.exports = router;
