const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { uploadAvatar } = require('../middlewares/upload.middleware');
const { body, param } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

// ─── Own Profile ──────────────────────────────────────────────────────────────
router.get('/me', protect, userCtrl.getMe);
router.put('/me', protect,
  [body('name').optional().trim().isLength({ max: 80 }), body('bio').optional().isLength({ max: 500 }), body('headline').optional().isLength({ max: 120 }), body('website').optional().isURL()],
  validate, userCtrl.updateMe);
router.delete('/me', protect, userCtrl.deleteMe);
router.put('/me/password', protect,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)],
  validate, userCtrl.changePassword);
router.post('/me/avatar', protect, uploadAvatar, userCtrl.uploadAvatar);

// ─── Public Profile ───────────────────────────────────────────────────────────
router.get('/:userId/public', userCtrl.getPublicProfile);

// ─── Admin User Management ────────────────────────────────────────────────────
router.get('/admin/users', protect, restrictTo('admin'), userCtrl.adminListUsers);
router.get('/admin/users/:userId', protect, restrictTo('admin'), userCtrl.adminGetUser);
router.put('/admin/users/:userId', protect, restrictTo('admin'), userCtrl.adminUpdateUser);
router.delete('/admin/users/:userId', protect, restrictTo('admin'), userCtrl.adminDeleteUser);
router.post('/admin/users/:userId/ban', protect, restrictTo('admin'), userCtrl.adminBanUser);
router.post('/admin/users/:userId/unban', protect, restrictTo('admin'), userCtrl.adminUnbanUser);

module.exports = router;
