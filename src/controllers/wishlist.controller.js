const { Wishlist } = require('../models/index');
const Course = require('../models/Course.model');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.getWishlist = catchAsync(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id })
    .populate({
      path: 'courses',
      match: { status: 'published' },
      select: 'title slug thumbnail price isFree stats level language',
      populate: { path: 'instructor', select: 'name avatar' },
    });
  res.json({ success: true, data: wishlist?.courses || [] });
});

exports.addToWishlist = catchAsync(async (req, res) => {
  const { courseId } = req.body;
  const course = await Course.findOne({ _id: courseId, status: 'published' });
  if (!course) throw new AppError('Course not found', 404);

  const wishlist = await Wishlist.findOneAndUpdate(
    { user: req.user._id },
    { $addToSet: { courses: courseId } },
    { new: true, upsert: true }
  );
  res.json({ success: true, message: 'Added to wishlist', data: { count: wishlist.courses.length } });
});

exports.removeFromWishlist = catchAsync(async (req, res) => {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { courses: req.params.courseId } },
    { new: true }
  );
  res.json({ success: true, message: 'Removed from wishlist', data: { count: wishlist?.courses.length || 0 } });
});
