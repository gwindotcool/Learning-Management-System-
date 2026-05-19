const Course = require('../models/Course.model');
const User = require('../models/User.model');
const { Enrollment, Order, Review, Payout } = require('../models/index');
const catchAsync = require('../utils/catchAsync');

// ─── INSTRUCTOR ANALYTICS ─────────────────────────────────────────────────────

exports.instructorOverview = catchAsync(async (req, res) => {
  const courses = await Course.find({ instructor: req.user._id }).select('_id stats');
  const courseIds = courses.map(c => c._id);

  const [enrollmentCount, revenueAgg, reviewAgg] = await Promise.all([
    Enrollment.countDocuments({ course: { $in: courseIds } }),
    Order.aggregate([
      { $match: { 'courses.course': { $in: courseIds }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Review.aggregate([
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);

  const grossRevenue = revenueAgg[0]?.total || 0;
  const share = parseFloat(process.env.INSTRUCTOR_REVENUE_SHARE || 70) / 100;

  res.json({
    success: true,
    data: {
      totalCourses: courses.length,
      totalStudents: enrollmentCount,
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      instructorRevenue: Math.round(grossRevenue * share * 100) / 100,
      avgRating: Math.round((reviewAgg[0]?.avgRating || 0) * 10) / 10,
      totalReviews: reviewAgg[0]?.count || 0,
    },
  });
});

exports.instructorRevenue = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const courses = await Course.find({ instructor: req.user._id }).select('_id title');
  const courseIds = courses.map(c => c._id);

  const matchStage = { 'courses.course': { $in: courseIds }, status: 'completed' };
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const revenue = await Order.aggregate([
    { $match: matchStage },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.json({ success: true, data: revenue });
});

exports.instructorEnrollments = catchAsync(async (req, res) => {
  const courses = await Course.find({ instructor: req.user._id }).select('_id');
  const courseIds = courses.map(c => c._id);

  const enrollments = await Enrollment.aggregate([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.json({ success: true, data: enrollments });
});

exports.instructorCourseAnalytics = catchAsync(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, instructor: req.user._id });
  if (!course) return res.status(403).json({ success: false, message: 'Access denied' });

  const enrollments = await Enrollment.find({ course: req.params.courseId })
    .select('completionPercentage isCompleted completedLectures');

  const completed = enrollments.filter(e => e.isCompleted).length;
  const avgCompletion = enrollments.length
    ? Math.round(enrollments.reduce((s, e) => s + e.completionPercentage, 0) / enrollments.length)
    : 0;

  const reviews = await Review.find({ course: req.params.courseId }).select('rating createdAt');
  const avgRating = reviews.length
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
    : 0;

  res.json({
    success: true,
    data: {
      totalEnrollments: enrollments.length,
      completedCount: completed,
      completionRate: Math.round((completed / (enrollments.length || 1)) * 100),
      avgCompletionPercentage: avgCompletion,
      totalReviews: reviews.length,
      avgRating,
    },
  });
});

exports.instructorReviewTrends = catchAsync(async (req, res) => {
  const courses = await Course.find({ instructor: req.user._id }).select('_id');
  const courseIds = courses.map(c => c._id);

  const trends = await Review.aggregate([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, rating: '$rating' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.json({ success: true, data: trends });
});

// ─── ADMIN ANALYTICS ──────────────────────────────────────────────────────────

exports.adminOverview = catchAsync(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalUsers, mau, totalCourses, publishedCourses, totalEnrollments, gmvAgg] = await Promise.all([
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo }, status: 'active' }),
    Course.countDocuments(),
    Course.countDocuments({ status: 'published' }),
    Enrollment.countDocuments(),
    Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, gmv: { $sum: '$total' } } }]),
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      monthlyActiveUsers: mau,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      gmv: Math.round((gmvAgg[0]?.gmv || 0) * 100) / 100,
    },
  });
});

exports.adminRevenue = catchAsync(async (req, res) => {
  const revenue = await Order.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, gmv: { $sum: '$total' }, orders: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
  res.json({ success: true, data: revenue });
});

exports.adminUserGrowth = catchAsync(async (req, res) => {
  const growth = await User.aggregate([
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, role: '$role' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
  res.json({ success: true, data: growth });
});

exports.adminCoursePerformance = catchAsync(async (req, res) => {
  const courses = await Course.find({ status: 'published' })
    .populate('instructor', 'name')
    .populate('category', 'name')
    .sort('-stats.totalStudents')
    .limit(20)
    .select('title stats level category instructor');
  res.json({ success: true, data: courses });
});

exports.exportReport = catchAsync(async (req, res) => {
  // In production: queue a job to generate CSV and email it
  res.json({ success: true, message: 'Report export queued. You will receive an email download link within minutes.', data: { requestedAt: new Date(), format: req.body.format || 'csv' } });
});
