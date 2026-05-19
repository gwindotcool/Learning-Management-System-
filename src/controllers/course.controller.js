const Course = require('../models/Course.model');
const { Section, Enrollment } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const ApiFeatures = require('../utils/ApiFeatures');
const cloudinaryService = require('../services/cloudinary.service');
const notificationService = require('../services/notification.service');

// ─── PUBLIC: List / Search Courses ────────────────────────────────────────────
exports.getCourses = catchAsync(async (req, res) => {
  const baseQuery = Course.find({ status: 'published' })
    .populate('instructor', 'name avatar headline')
    .populate('category', 'name slug');

  const features = new ApiFeatures(baseQuery, req.query)
    .filter()
    .search(['title', 'shortDescription'])
    .sort()
    .limitFields();

  await features.paginate();
  const courses = await features.query;

  res.json({ success: true, data: courses, meta: features.meta });
});

// ─── PUBLIC: Get Single Course ────────────────────────────────────────────────
exports.getCourse = catchAsync(async (req, res) => {
  const course = await Course.findOne({ $or: [{ _id: req.params.courseId }, { slug: req.params.courseId }], status: 'published' })
    .populate('instructor', 'name avatar headline bio totalStudents totalCourses')
    .populate('category', 'name slug')
    .populate({ path: 'sections', populate: { path: 'lectures', select: 'title type duration isFree order' } });

  if (!course) throw new AppError('Course not found', 404);

  // Check if current user is enrolled (for unlocking content)
  let isEnrolled = false;
  if (req.user) {
    const enrollment = await Enrollment.findOne({ student: req.user._id, course: course._id });
    isEnrolled = !!enrollment;
  }

  res.json({ success: true, data: { course, isEnrolled } });
});

// ─── PUBLIC: Featured Courses ─────────────────────────────────────────────────
exports.getFeaturedCourses = catchAsync(async (req, res) => {
  const courses = await Course.find({ status: 'published', isFeatured: true })
    .populate('instructor', 'name avatar')
    .sort('-stats.totalStudents')
    .limit(12)
    .select('title slug thumbnail price isFree stats level language');

  res.json({ success: true, data: courses });
});

// ─── PUBLIC: Trending Courses ─────────────────────────────────────────────────
exports.getTrendingCourses = catchAsync(async (req, res) => {
  // "Trending" = most enrolled in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const trending = await Enrollment.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: '$course', enrollmentCount: { $sum: 1 } } },
    { $sort: { enrollmentCount: -1 } },
    { $limit: 12 },
    { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
    { $unwind: '$course' },
    { $match: { 'course.status': 'published' } },
    { $replaceRoot: { newRoot: '$course' } },
  ]);

  res.json({ success: true, data: trending });
});

// ─── INSTRUCTOR: Create Course ────────────────────────────────────────────────
exports.createCourse = catchAsync(async (req, res) => {
  const course = await Course.create({
    ...req.body,
    instructor: req.user._id,
    status: 'draft',
  });

  res.status(201).json({ success: true, message: 'Course created as draft', data: course });
});

// ─── INSTRUCTOR: Get Own Courses ──────────────────────────────────────────────
exports.getInstructorCourses = catchAsync(async (req, res) => {
  const features = new ApiFeatures(
    Course.find({ instructor: req.user._id }).populate('category', 'name'),
    req.query
  ).filter().sort().paginate();
  await features;
  const courses = await features.query;
  res.json({ success: true, data: courses, meta: features.meta });
});

// ─── INSTRUCTOR: Update Course ────────────────────────────────────────────────
exports.updateCourse = catchAsync(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, instructor: req.user._id });
  if (!course) throw new AppError('Course not found or you are not the instructor', 404);
  if (course.status === 'published') throw new AppError('Cannot edit a published course directly. Submit for review.', 400);

  const allowed = ['title', 'description', 'shortDescription', 'price', 'level', 'language', 'category', 'requirements', 'objectives', 'targetAudience', 'tags'];
  allowed.forEach(field => { if (req.body[field] !== undefined) course[field] = req.body[field]; });

  await course.save();
  res.json({ success: true, data: course });
});

// ─── INSTRUCTOR: Delete Course ────────────────────────────────────────────────
exports.deleteCourse = catchAsync(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, instructor: req.user._id });
  if (!course) throw new AppError('Course not found', 404);

  const hasEnrollments = await Enrollment.exists({ course: course._id });
  if (hasEnrollments) {
    course.status = 'archived';
    await course.save();
    return res.json({ success: true, message: 'Course archived (has enrollments, cannot hard-delete)' });
  }

  await course.deleteOne();
  res.json({ success: true, message: 'Course deleted successfully' });
});

// ─── INSTRUCTOR: Submit for Review ────────────────────────────────────────────
exports.submitCourse = catchAsync(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, instructor: req.user._id });
  if (!course) throw new AppError('Course not found', 404);
  if (course.status !== 'draft') throw new AppError('Only draft courses can be submitted', 400);

  // Basic validation before submission
  const sections = await Section.find({ course: course._id });
  if (sections.length === 0) throw new AppError('Course must have at least one section before submission', 400);

  course.status = 'pending';
  await course.save();

  res.json({ success: true, message: 'Course submitted for admin review' });
});

// ─── INSTRUCTOR: Upload Thumbnail ─────────────────────────────────────────────
exports.uploadThumbnail = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload a thumbnail image', 400);

  const course = await Course.findOne({ _id: req.params.courseId, instructor: req.user._id });
  if (!course) throw new AppError('Course not found', 404);

  if (course.thumbnail?.publicId) {
    await cloudinaryService.deleteFile(course.thumbnail.publicId);
  }

  const result = await cloudinaryService.uploadImage(req.file.buffer, `lms/thumbnails/${course._id}`);
  course.thumbnail = { url: result.secure_url, publicId: result.public_id };
  await course.save({ validateBeforeSave: false });

  res.json({ success: true, data: { thumbnailUrl: result.secure_url } });
});

// ─── ADMIN: List All Courses ──────────────────────────────────────────────────
exports.adminGetCourses = catchAsync(async (req, res) => {
  const features = new ApiFeatures(
    Course.find()
      .populate('instructor', 'name email')
      .populate('category', 'name'),
    req.query
  ).filter().sort().paginate();
  await features;
  const courses = await features.query;
  res.json({ success: true, data: courses, meta: features.meta });
});

// ─── ADMIN: Approve Course ────────────────────────────────────────────────────
exports.approveCourse = catchAsync(async (req, res) => {
  const course = await Course.findById(req.params.courseId).populate('instructor', 'name email');
  if (!course) throw new AppError('Course not found', 404);
  if (course.status !== 'pending') throw new AppError('Course is not pending review', 400);

  course.status = 'published';
  course.approvedBy = req.user._id;
  course.approvedAt = new Date();
  course.publishedAt = new Date();
  await course.save({ validateBeforeSave: false });

  await notificationService.send({
    userId: course.instructor._id,
    type: 'course_approved',
    title: 'Course Approved!',
    message: `Your course "${course.title}" has been approved and is now live.`,
    data: { courseId: course._id, courseSlug: course.slug },
  });

  res.json({ success: true, message: 'Course approved and published', data: course });
});

// ─── ADMIN: Reject Course ─────────────────────────────────────────────────────
exports.rejectCourse = catchAsync(async (req, res) => {
  const course = await Course.findById(req.params.courseId).populate('instructor');
  if (!course) throw new AppError('Course not found', 404);
  if (course.status !== 'pending') throw new AppError('Course is not pending review', 400);

  course.status = 'rejected';
  course.rejectionReason = req.body.reason;
  await course.save({ validateBeforeSave: false });

  await notificationService.send({
    userId: course.instructor._id,
    type: 'course_rejected',
    title: 'Course Needs Revision',
    message: `Your course "${course.title}" requires changes: ${req.body.reason}`,
    data: { courseId: course._id, reason: req.body.reason },
  });

  res.json({ success: true, message: 'Course rejected', data: course });
});
