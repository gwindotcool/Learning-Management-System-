const User = require('../models/User.model');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const cloudinaryService = require('../services/cloudinary.service');

exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: user.toSafeObject() });
});

exports.updateMe = catchAsync(async (req, res) => {
  const allowed = ['name', 'bio', 'headline', 'website', 'socialLinks'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (Object.keys(updates).length === 0) throw new AppError('No valid fields provided for update', 400);

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, data: user.toSafeObject() });
});

exports.deleteMe = catchAsync(async (req, res) => {
  // GDPR soft-delete: anonymise the account
  await User.findByIdAndUpdate(req.user._id, {
    status: 'banned',
    name: 'Deleted User',
    email: `deleted_${req.user._id}@deleted.lms`,
    bio: null,
    headline: null,
    website: null,
    googleId: null,
    githubId: null,
    refreshTokens: [],
  });
  res.json({ success: true, message: 'Your account has been deleted' });
});

exports.changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new AppError('Both currentPassword and newPassword are required', 400);
  if (newPassword.length < 8) throw new AppError('New password must be at least 8 characters', 400);

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) throw new AppError('Current password is incorrect', 401);
  if (currentPassword === newPassword) throw new AppError('New password must be different from current', 400);

  user.password = newPassword;
  user.refreshTokens = []; // invalidate all sessions
  await user.save();

  res.json({ success: true, message: 'Password updated successfully. Please log in again.' });
});

exports.uploadAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image file', 400);

  const user = await User.findById(req.user._id);
  if (user.avatar?.publicId) await cloudinaryService.deleteFile(user.avatar.publicId);

  const result = await cloudinaryService.uploadImage(req.file.buffer, `lms/avatars/${user._id}`, {
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  });

  user.avatar = { url: result.secure_url, publicId: result.public_id };
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, data: { avatarUrl: result.secure_url } });
});

exports.getPublicProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select('name bio headline avatar website socialLinks role createdAt');
  if (!user) throw new AppError('User not found', 404);

  const Course = require('../models/Course.model');
  const { Enrollment } = require('../models/index');

  const [courseCount, totalStudents] = await Promise.all([
    Course.countDocuments({ instructor: user._id, status: 'published' }),
    Enrollment.countDocuments({ course: { $in: await Course.find({ instructor: user._id }).distinct('_id') } }),
  ]);

  res.json({ success: true, data: { ...user.toObject(), courseCount, totalStudents } });
});

// ─── ADMIN ─────────────────────────────────────────────────────────────────────
exports.adminListUsers = catchAsync(async (req, res) => {
  const { role, status, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];

  const [users, total] = await Promise.all([
    User.find(filter).select('-password -refreshTokens -mfaSecret').sort('-createdAt')
      .skip((page - 1) * limit).limit(+limit),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, data: users, meta: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.adminGetUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId).select('-password -refreshTokens -mfaSecret');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

exports.adminUpdateUser = catchAsync(async (req, res) => {
  const allowed = ['role', 'status', 'isEmailVerified'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const user = await User.findByIdAndUpdate(req.params.userId, updates, { new: true, runValidators: true })
    .select('-password -refreshTokens');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

exports.adminDeleteUser = catchAsync(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.userId);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, message: 'User permanently deleted' });
});

exports.adminBanUser = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { status: 'banned', banReason: req.body.reason, refreshTokens: [] },
    { new: true }
  ).select('-password -refreshTokens');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, message: 'User banned', data: user });
});

exports.adminUnbanUser = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { status: 'active', $unset: { banReason: 1 } },
    { new: true }
  ).select('-password -refreshTokens');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, message: 'User account restored', data: user });
});
