const { Notification, NotificationPreference } = require('../models/index');
const logger = require('../utils/logger');

/**
 * Send a notification to a user.
 * Delivers in-app (always), and optionally via email/push based on preferences.
 */
const send = async ({ userId, type, title, message, data = {} }) => {
  try {
    const prefs = await NotificationPreference.findOne({ user: userId });

    // In-app notification (stored in DB)
    const notif = await Notification.create({ user: userId, type, title, message, data });

    // Emit via Socket.io if connected
    try {
      const io = require('../app').app?.get('io');
      if (io) {
        io.to(`user:${userId}`).emit('notification', {
          id: notif._id,
          type,
          title,
          message,
          data,
          createdAt: notif.createdAt,
        });
      }
    } catch { /* socket optional */ }

    // Email notification
    if (!prefs || prefs.email) {
      const emailService = require('./email.service');
      await emailService.sendNotificationEmail(userId, { title, message, type });
    }

    return notif;
  } catch (err) {
    logger.error('Notification send error:', err.message);
  }
};

const markRead = async (notificationId, userId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

const markAllRead = async (userId) => {
  return Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

module.exports = { send, markRead, markAllRead };
