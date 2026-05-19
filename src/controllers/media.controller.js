const { Lecture } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const cloudinaryService = require('../services/cloudinary.service');

exports.uploadImage = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image file', 400);
  const result = await cloudinaryService.uploadImage(req.file.buffer, 'lms/general');
  res.json({ success: true, data: { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height } });
});

exports.initiateVideoUpload = catchAsync(async (req, res) => {
  const { filename, size, mimeType } = req.body;
  if (!filename || !size) throw new AppError('filename and size are required', 400);
  // In production: initiate AWS S3 multipart. Here we return a stub uploadId.
  const uploadId = `lms_upload_${Date.now()}_${req.user._id}`;
  const partSize = 6 * 1024 * 1024; // 6MB chunks
  const numParts = Math.ceil(size / partSize);
  res.json({ success: true, data: { uploadId, numParts, partSize, expiresIn: 3600 } });
});

exports.uploadVideoPart = catchAsync(async (req, res) => {
  const { uploadId, partNumber } = req.params;
  if (!req.file && !req.body) throw new AppError('No data received for this part', 400);
  // In production: upload this part to S3 and get ETag back
  const etag = `etag_part${partNumber}_${Date.now()}`;
  res.json({ success: true, data: { uploadId, partNumber: +partNumber, etag } });
});

exports.completeVideoUpload = catchAsync(async (req, res) => {
  const { uploadId } = req.params;
  const { parts } = req.body; // [{ partNumber, etag }]
  if (!Array.isArray(parts)) throw new AppError('parts array is required', 400);
  // In production: call S3 CompleteMultipartUpload, then queue transcoding
  res.json({ success: true, message: 'Upload complete. Transcoding started.', data: { uploadId, videoId: `vid_${Date.now()}`, status: 'processing' } });
});

exports.abortVideoUpload = catchAsync(async (req, res) => {
  const { uploadId } = req.params;
  // In production: call S3 AbortMultipartUpload
  res.json({ success: true, message: 'Upload aborted and temporary files cleaned up', data: { uploadId } });
});

exports.getStreamingUrl = catchAsync(async (req, res) => {
  const lecture = await Lecture.findById(req.params.videoId).select('video course');
  if (!lecture) throw new AppError('Video not found', 404);
  if (!lecture.video?.publicId) throw new AppError('Video not yet uploaded for this lecture', 404);

  const streamUrl = cloudinaryService.getSignedStreamingUrl(lecture.video.publicId);
  res.json({ success: true, data: { streamUrl, type: 'hls', expiresIn: 3600 } });
});

exports.getCaptions = catchAsync(async (req, res) => {
  const lecture = await Lecture.findById(req.params.videoId).select('captions title');
  if (!lecture) throw new AppError('Lecture not found', 404);
  res.json({ success: true, data: lecture.captions || [] });
});

exports.uploadCaptions = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload a caption file (.vtt or .srt)', 400);
  const lecture = await Lecture.findById(req.params.videoId);
  if (!lecture) throw new AppError('Lecture not found', 404);

  const language = req.body.language || 'en';
  const label = req.body.label || language.toUpperCase();

  const result = await cloudinaryService.uploadRaw(
    req.file.buffer,
    `lms/captions/${lecture._id}`,
    `${language}_${req.file.originalname}`
  );

  const existingIdx = lecture.captions.findIndex(c => c.language === language);
  const captionEntry = { language, label, url: result.secure_url, publicId: result.public_id };

  if (existingIdx > -1) lecture.captions[existingIdx] = captionEntry;
  else lecture.captions.push(captionEntry);

  await lecture.save();
  res.status(201).json({ success: true, message: `Captions uploaded for language: ${language}`, data: lecture.captions });
});
