const { Enrollment } = require('../models/index');
const Course = require('../models/Course.model');
const { Lecture, Section } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const notificationService = require('../services/notification.service');

// ─── Enroll in Course ─────────────────────────────────────────────────────────
exports.enroll = catchAsync(async (req, res) => {
  const { courseId } = req.body;

  const course = await Course.findOne({ _id: courseId, status: 'published' });
  if (!course) throw new AppError('Course not found', 404);

  if (course.price > 0) {
    throw new AppError('This is a paid course. Please complete checkout first.', 402);
  }

  const existing = await Enrollment.findOne({ student: req.user._id, course: courseId });
  if (existing) throw new AppError('You are already enrolled in this course', 400);

  const enrollment = await Enrollment.create({ student: req.user._id, course: courseId });

  // Update course student count
  await Course.findByIdAndUpdate(courseId, { $inc: { 'stats.totalStudents': 1 } });

  // Notify instructor
  await notificationService.send({
    userId: course.instructor,
    type: 'enrollment',
    title: 'New Student Enrolled',
    message: `A new student enrolled in "${course.title}"`,
    data: { courseId, studentId: req.user._id },
  });

  res.status(201).json({ success: true, message: 'Enrolled successfully', data: enrollment });
});

// ─── Get My Enrollments ───────────────────────────────────────────────────────
exports.getMyEnrollments = catchAsync(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user._id })
    .populate({
      path: 'course',
      select: 'title thumbnail slug stats level language instructor',
      populate: { path: 'instructor', select: 'name avatar' },
    })
    .sort('-lastAccessedAt');

  res.json({ success: true, data: enrollments });
});

// ─── Check Enrollment Status ──────────────────────────────────────────────────
exports.checkEnrollment = catchAsync(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  });

  res.json({
    success: true,
    data: {
      isEnrolled: !!enrollment,
      enrollment: enrollment || null,
    },
  });
});

// ─── INSTRUCTOR: Get Enrolled Students ───────────────────────────────────────
exports.getCourseStudents = catchAsync(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, instructor: req.user._id });
  if (!course) throw new AppError('Course not found or access denied', 404);

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const [students, total] = await Promise.all([
    Enrollment.find({ course: req.params.courseId })
      .populate('student', 'name email avatar createdAt')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Enrollment.countDocuments({ course: req.params.courseId }),
  ]);

  res.json({
    success: true,
    data: students,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ─── Get Course Progress ──────────────────────────────────────────────────────
exports.getCourseProgress = catchAsync(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  });
  if (!enrollment) throw new AppError('You are not enrolled in this course', 403);

  const sections = await Section.find({ course: req.params.courseId })
    .populate('lectures', '_id title type duration')
    .sort('order');

  const totalLectures = sections.reduce((sum, s) => sum + s.lectures.length, 0);
  const completedCount = enrollment.completedLectures.length;

  const progressBySections = sections.map(section => ({
    sectionId: section._id,
    title: section.title,
    lectures: section.lectures.map(lecture => ({
      lectureId: lecture._id,
      title: lecture.title,
      type: lecture.type,
      duration: lecture.duration,
      isCompleted: enrollment.completedLectures.some(id => id.equals(lecture._id)),
      savedPosition: enrollment.lecturePositions.get(lecture._id.toString()) || 0,
    })),
  }));

  res.json({
    success: true,
    data: {
      completionPercentage: enrollment.completionPercentage,
      completedLectures: completedCount,
      totalLectures,
      isCompleted: enrollment.isCompleted,
      certificateIssued: enrollment.certificateIssued,
      lastAccessedAt: enrollment.lastAccessedAt,
      sections: progressBySections,
    },
  });
});

// ─── Mark Lecture Complete ────────────────────────────────────────────────────
exports.markLectureComplete = catchAsync(async (req, res) => {
  const { courseId, lectureId } = req.params;

  const enrollment = await Enrollment.findOne({ student: req.user._id, course: courseId });
  if (!enrollment) throw new AppError('You are not enrolled in this course', 403);

  const lecture = await Lecture.findOne({ _id: lectureId, course: courseId });
  if (!lecture) throw new AppError('Lecture not found in this course', 404);

  // Idempotent add
  if (!enrollment.completedLectures.some(id => id.equals(lectureId))) {
    enrollment.completedLectures.push(lectureId);
  }

  // Recalculate percentage
  const totalLectures = await Lecture.countDocuments({ course: courseId });
  enrollment.completionPercentage = totalLectures > 0
    ? Math.round((enrollment.completedLectures.length / totalLectures) * 100)
    : 0;
  enrollment.lastAccessedAt = new Date();

  await enrollment.save();

  res.json({
    success: true,
    data: {
      completionPercentage: enrollment.completionPercentage,
      completedLectures: enrollment.completedLectures.length,
      totalLectures,
    },
  });
});

// ─── Unmark Lecture Complete ──────────────────────────────────────────────────
exports.unmarkLectureComplete = catchAsync(async (req, res) => {
  const { courseId, lectureId } = req.params;

  const enrollment = await Enrollment.findOne({ student: req.user._id, course: courseId });
  if (!enrollment) throw new AppError('Not enrolled', 403);

  enrollment.completedLectures = enrollment.completedLectures.filter(id => !id.equals(lectureId));

  const totalLectures = await Lecture.countDocuments({ course: courseId });
  enrollment.completionPercentage = totalLectures > 0
    ? Math.round((enrollment.completedLectures.length / totalLectures) * 100)
    : 0;

  await enrollment.save();

  res.json({ success: true, data: { completionPercentage: enrollment.completionPercentage } });
});

// ─── Save Video Position ──────────────────────────────────────────────────────
exports.saveVideoPosition = catchAsync(async (req, res) => {
  const { courseId, lectureId } = req.params;
  const { positionSeconds } = req.body;

  if (typeof positionSeconds !== 'number' || positionSeconds < 0) {
    throw new AppError('Invalid position value', 400);
  }

  const enrollment = await Enrollment.findOne({ student: req.user._id, course: courseId });
  if (!enrollment) throw new AppError('Not enrolled', 403);

  enrollment.lecturePositions.set(lectureId, positionSeconds);
  enrollment.lastAccessedAt = new Date();
  await enrollment.save();

  res.json({ success: true, data: { positionSeconds } });
});
