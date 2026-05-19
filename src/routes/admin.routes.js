const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const catchAsync = require('../utils/catchAsync');

let platformSettings = {
  maintenanceMode: false,
  allowNewRegistrations: true,
  allowNewCourses: true,
  maxFileUploadMB: 2048,
  instructorRevenueShare: 70,
  certificateThreshold: 80,
  featureFlags: { mfa: true, oauth: true, stripe: true, realTimeNotifications: true },
};
const auditLogs = [];

router.get('/settings', protect, restrictTo('admin'), (req, res) => {
  res.json({ success: true, data: platformSettings });
});

router.put('/settings', protect, restrictTo('admin'), catchAsync(async (req, res) => {
  const allowed = ['maintenanceMode', 'allowNewRegistrations', 'allowNewCourses', 'maxFileUploadMB', 'instructorRevenueShare', 'certificateThreshold', 'featureFlags'];
  allowed.forEach(k => { if (req.body[k] !== undefined) platformSettings[k] = req.body[k]; });
  auditLogs.unshift({ userId: req.user._id, action: 'UPDATE_SETTINGS', resource: 'platform', details: req.body, timestamp: new Date() });
  res.json({ success: true, data: platformSettings });
}));

router.get('/audit-logs', protect, restrictTo('admin'), (req, res) => {
  // Sanitize pagination parameters
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  
  const total = auditLogs.length;
  const logs = auditLogs.slice(offset, offset + limit);
  res.json({ success: true, data: logs, meta: { total, page, limit } });
});

module.exports = router;
