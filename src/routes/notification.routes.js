const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notification.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/', protect, ctrl.getNotifications);
router.put('/read-all', protect, ctrl.markAllAsRead);
router.get('/preferences', protect, ctrl.getPreferences);
router.put('/preferences', protect, ctrl.updatePreferences);
router.put('/:notificationId/read', protect, ctrl.markAsRead);
router.delete('/:notificationId', protect, ctrl.deleteNotification);

module.exports = router;
