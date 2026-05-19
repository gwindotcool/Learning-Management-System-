const Course = require('../models/Course.model');
const { Section, Lecture } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const cloudinaryService = require('../services/cloudinary.service');

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

exports.getSections = catchAsync(async (req, res) => {
  const sections = await Section.find({ course: req.params.courseId })
    .populate({ path: 'lectures', select: 'title type duration isFree order', options: { sort: { order: 1 } } })
    .sort('order');
  res.json({ success: true, data: sections });
});

exports.addSection = catchAsync(async (req, res) => {
  await requireCourseOwnership(req.params.courseId, req.user._id);
  const count = await Section.countDocuments({ course: req.params.courseId });
  const section = await Section.create({
    course: req.params.courseId,
    title: req.body.title,
    order: req.body.order ?? count,
  });
  await Course.findByIdAndUpdate(req.params.courseId, { $inc: { 'stats.totalSections': 1 } });
  res.status(201).json({ success: true, data: section });
});

exports.updateSection = catchAsync(async (req, res) => {
  await requireCourseOwnership(req.params.courseId, req.user._id);
  const section = await Section.findOneAndUpdate(
    { _id: req.params.sectionId, course: req.params.courseId },
    { title: req.body.title, order: req.body.order },
    { new: true, runValidators: true }
  );
  if (!section) throw new AppError('Section not found', 404);
  res.json({ success: true, data: section });
});

exports.deleteSection = catchAsync(async (req, res) => {
  await requireCourseOwnership(req.params.courseId, req.user._id);
  const section = await Section.findOneAndDelete({ _id: req.params.sectionId, course: req.params.courseId });
  if (!section) throw new AppError('Section not found', 404);
  // Cascade delete lectures
  const lectures = await Lecture.find({ section: section._id });
  for (const lec of lectures) {
    if (lec.video?.publicId) await cloudinaryService.deleteFile(lec.video.publicId, 'video');
  }
  await Lecture.deleteMany({ section: section._id });
  await Course.findByIdAndUpdate(req.params.courseId, { $inc: { 'stats.totalSections': -1, 'stats.totalLectures': -lectures.length } });
  res.json({ success: true, message: 'Section and its lectures deleted' });
});

exports.reorderSections = catchAsync(async (req, res) => {
  await requireCourseOwnership(req.params.courseId, req.user._id);
  const { sectionIds } = req.body;
  if (!Array.isArray(sectionIds)) throw new AppError('sectionIds must be an array', 400);
  const ops = sectionIds.map((id, index) => ({
    updateOne: { filter: { _id: id, course: req.params.courseId }, update: { order: index } },
  }));
  await Section.bulkWrite(ops);
  res.json({ success: true, message: 'Sections reordered' });
});

// ─── LECTURES ─────────────────────────────────────────────────────────────────

exports.createLecture = catchAsync(async (req, res) => {
  const section = await Section.findById(req.params.sectionId);
  if (!section) throw new AppError('Section not found', 404);
  await requireCourseOwnership(section.course, req.user._id);

  const count = await Lecture.countDocuments({ section: req.params.sectionId });
  const lecture = await Lecture.create({
    section: req.params.sectionId,
    course: section.course,
    title: req.body.title,
    type: req.body.type || 'video',
    order: req.body.order ?? count,
    description: req.body.description,
    isFree: req.body.isFree || false,
    article: req.body.type === 'article' ? { content: req.body.content } : undefined,
  });
  await Course.findByIdAndUpdate(section.course, { $inc: { 'stats.totalLectures': 1 } });
  res.status(201).json({ success: true, data: lecture });
});

exports.getLecture = catchAsync(async (req, res) => {
  const lecture = await Lecture.findById(req.params.lectureId).populate('section', 'title course');
  if (!lecture) throw new AppError('Lecture not found', 404);

  // Protected content: check enrollment unless isFree
  if (!lecture.isFree) {
    if (!req.user) throw new AppError('Authentication required to access this lecture', 401);
    const { Enrollment } = require('../models/index');
    const enrolled = await Enrollment.exists({ student: req.user._id, course: lecture.course });
    if (!enrolled && req.user.role !== 'admin') throw new AppError('Enroll in this course to access this lecture', 403);
  }

  res.json({ success: true, data: lecture });
});

exports.updateLecture = catchAsync(async (req, res) => {
  const lecture = await Lecture.findById(req.params.lectureId);
  if (!lecture) throw new AppError('Lecture not found', 404);
  await requireCourseOwnership(lecture.course, req.user._id);

  const allowed = ['title', 'description', 'isFree', 'order'];
  allowed.forEach(f => { if (req.body[f] !== undefined) lecture[f] = req.body[f]; });
  if (lecture.type === 'article' && req.body.content) lecture.article.content = req.body.content;
  await lecture.save();
  res.json({ success: true, data: lecture });
});

exports.deleteLecture = catchAsync(async (req, res) => {
  const lecture = await Lecture.findById(req.params.lectureId);
  if (!lecture) throw new AppError('Lecture not found', 404);
  await requireCourseOwnership(lecture.course, req.user._id);

  if (lecture.video?.publicId) await cloudinaryService.deleteFile(lecture.video.publicId, 'video');
  await lecture.deleteOne();
  await Course.findByIdAndUpdate(lecture.course, { $inc: { 'stats.totalLectures': -1 } });
  res.json({ success: true, message: 'Lecture deleted' });
});

exports.reorderLectures = catchAsync(async (req, res) => {
  const { lectureIds } = req.body;
  if (!Array.isArray(lectureIds)) throw new AppError('lectureIds must be an array', 400);
  const ops = lectureIds.map((id, index) => ({
    updateOne: { filter: { _id: id, section: req.params.sectionId }, update: { order: index } },
  }));
  await Lecture.bulkWrite(ops);
  res.json({ success: true, message: 'Lectures reordered' });
});

exports.uploadLectureVideo = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload a video file', 400);
  const lecture = await Lecture.findById(req.params.lectureId);
  if (!lecture) throw new AppError('Lecture not found', 404);
  await requireCourseOwnership(lecture.course, req.user._id);

  if (lecture.video?.publicId) await cloudinaryService.deleteFile(lecture.video.publicId, 'video');

  lecture.video = { status: 'processing' };
  await lecture.save();

  // Upload async — respond immediately so client can poll status
  cloudinaryService.uploadVideo(req.file.buffer, `lms/lectures/${lecture._id}`)
    .then(async (result) => {
      lecture.video = {
        url: result.secure_url,
        publicId: result.public_id,
        duration: Math.round(result.duration || 0),
        status: 'ready',
      };
      await Course.findByIdAndUpdate(lecture.course, {
        $inc: { 'stats.totalDuration': Math.round(result.duration || 0) },
      });
      await lecture.save();
    })
    .catch(async (err) => {
      lecture.video.status = 'failed';
      await lecture.save();
      require('../utils/logger').error('Video upload failed:', err.message);
    });

  res.json({ success: true, message: 'Video upload started. Poll /video/status for progress.', data: { status: 'processing' } });
});

exports.getLectureVideoStatus = catchAsync(async (req, res) => {
  const lecture = await Lecture.findById(req.params.lectureId).select('video');
  if (!lecture) throw new AppError('Lecture not found', 404);
  res.json({ success: true, data: { status: lecture.video?.status || 'pending', duration: lecture.video?.duration } });
});

exports.uploadAttachment = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload a file', 400);
  const lecture = await Lecture.findById(req.params.lectureId);
  if (!lecture) throw new AppError('Lecture not found', 404);
  await requireCourseOwnership(lecture.course, req.user._id);

  const result = await cloudinaryService.uploadRaw(
    req.file.buffer,
    `lms/attachments/${lecture._id}`,
    req.file.originalname
  );

  lecture.attachments.push({
    name: req.file.originalname,
    url: result.secure_url,
    publicId: result.public_id,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
  await lecture.save();

  res.status(201).json({ success: true, data: lecture.attachments });
});

exports.deleteAttachment = catchAsync(async (req, res) => {
  const lecture = await Lecture.findById(req.params.lectureId);
  if (!lecture) throw new AppError('Lecture not found', 404);
  await requireCourseOwnership(lecture.course, req.user._id);

  const attachment = lecture.attachments.id(req.params.attachmentId);
  if (!attachment) throw new AppError('Attachment not found', 404);

  await cloudinaryService.deleteFile(attachment.publicId, 'raw');
  attachment.deleteOne();
  await lecture.save();

  res.json({ success: true, message: 'Attachment deleted' });
});

// ─── Helper ───────────────────────────────────────────────────────────────────
async function requireCourseOwnership(courseId, userId) {
  const course = await Course.findOne({ _id: courseId, instructor: userId });
  if (!course) throw new AppError('Course not found or access denied', 403);
  return course;
}
