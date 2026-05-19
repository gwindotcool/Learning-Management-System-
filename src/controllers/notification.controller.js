const { Notification, NotificationPreference } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.getNotifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id })
      .sort('-createdAt')
      .skip(skip)
      .limit(+limit),
    Notification.countDocuments({ user: req.user._id }),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  res.json({
    success: true,
    data: notifications,
    meta: { page: +page, limit: +limit, total, unreadCount, totalPages: Math.ceil(total / +limit) },
  });
});

exports.markAsRead = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, user: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new AppError('Notification not found', 404);
  res.json({ success: true, data: notification });
});

exports.markAllAsRead = catchAsync(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  res.json({ success: true, message: `${result.modifiedCount} notifications marked as read` });
});

exports.deleteNotification = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.notificationId,
    user: req.user._id,
  });
  if (!notification) throw new AppError('Notification not found', 404);
  res.json({ success: true, message: 'Notification deleted' });
});

exports.getPreferences = catchAsync(async (req, res) => {
  const prefs = await NotificationPreference.findOne({ user: req.user._id });
  res.json({
    success: true,
    data: prefs || {
      email: true, push: true, inApp: true,
      types: { enrollment: true, review: true, payment: true, marketing: false },
    },
  });
});

exports.updatePreferences = catchAsync(async (req, res) => {
  const prefs = await NotificationPreference.findOneAndUpdate(
    { user: req.user._id },
    { ...req.body, user: req.user._id },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ success: true, data: prefs });
});
