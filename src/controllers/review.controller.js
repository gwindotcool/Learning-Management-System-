const { Review, Enrollment } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.getCourseReviews = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
  const [reviews, total] = await Promise.all([
    Review.find({ course: req.params.courseId })
      .populate('student', 'name avatar')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(+limit),
    Review.countDocuments({ course: req.params.courseId }),
  ]);
  res.json({ success: true, data: reviews, meta: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.createReview = catchAsync(async (req, res) => {
  const enrolled = await Enrollment.exists({ student: req.user._id, course: req.params.courseId });
  if (!enrolled) throw new AppError('You must be enrolled to leave a review', 403);
  const existing = await Review.findOne({ course: req.params.courseId, student: req.user._id });
  if (existing) throw new AppError('You have already reviewed this course', 400);
  const review = await Review.create({
    course: req.params.courseId,
    student: req.user._id,
    rating: req.body.rating,
    comment: req.body.comment,
  });
  res.status(201).json({ success: true, data: review });
});

exports.updateReview = catchAsync(async (req, res) => {
  const review = await Review.findOneAndUpdate(
    { _id: req.params.reviewId, student: req.user._id },
    { rating: req.body.rating, comment: req.body.comment },
    { new: true, runValidators: true }
  );
  if (!review) throw new AppError('Review not found or you are not the author', 404);
  res.json({ success: true, data: review });
});

exports.deleteReview = catchAsync(async (req, res) => {
  const filter = req.user.role === 'admin'
    ? { _id: req.params.reviewId }
    : { _id: req.params.reviewId, student: req.user._id };
  const review = await Review.findOneAndDelete(filter);
  if (!review) throw new AppError('Review not found', 404);
  await Review.recalculateCourseRating(req.params.courseId);
  res.json({ success: true, message: 'Review deleted' });
});

exports.markHelpful = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.reviewId);
  if (!review) throw new AppError('Review not found', 404);
  const idx = review.helpfulVotes.findIndex(id => id.equals(req.user._id));
  if (idx > -1) {
    review.helpfulVotes.splice(idx, 1);
    review.helpfulCount = Math.max(0, review.helpfulCount - 1);
  } else {
    review.helpfulVotes.push(req.user._id);
    review.helpfulCount += 1;
  }
  await review.save();
  res.json({ success: true, data: { helpfulCount: review.helpfulCount, voted: idx === -1 } });
});

exports.respondToReview = catchAsync(async (req, res) => {
  const review = await Review.findByIdAndUpdate(
    req.params.reviewId,
    { instructorResponse: req.body.response, instructorResponseAt: new Date() },
    { new: true }
  );
  if (!review) throw new AppError('Review not found', 404);
  res.json({ success: true, data: review });
});

exports.reportReview = catchAsync(async (req, res) => {
  const review = await Review.findByIdAndUpdate(
    req.params.reviewId,
    { isReported: true, reportReason: req.body.reason, reportedBy: req.user._id },
    { new: true }
  );
  if (!review) throw new AppError('Review not found', 404);
  res.json({ success: true, message: 'Review reported for moderation' });
});

exports.getReportedReviews = catchAsync(async (req, res) => {
  const reviews = await Review.find({ isReported: true })
    .populate('student', 'name email')
    .populate('course', 'title')
    .sort('-createdAt');
  res.json({ success: true, data: reviews });
});

exports.adminDeleteReview = catchAsync(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.reviewId);
  if (!review) throw new AppError('Review not found', 404);
  await Review.recalculateCourseRating(review.course);
  res.json({ success: true, message: 'Review removed by admin' });
});
