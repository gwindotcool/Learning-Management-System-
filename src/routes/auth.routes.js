const express = require('express');
const router = express.Router();
const passport = require('passport');
const { body, param } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { strictLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate.middleware');

// Registration & Login
router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and a number'),
    body('role').optional().isIn(['student', 'instructor']),
  ],
  validate,
  authController.register
);

router.post('/login',
  strictLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  authController.login
);

router.post('/logout', protect, authController.logout);

router.post('/refresh-token',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate,
  authController.refreshToken
);

router.post('/forgot-password',
  strictLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  authController.forgotPassword
);

router.post('/reset-password/:token',
  [
    param('token').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  ],
  validate,
  authController.resetPassword
);

router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', protect, authController.resendVerification);

// OAuth — Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed` }),
  authController.oauthCallback
);

// OAuth — GitHub
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed` }),
  authController.oauthCallback
);

// MFA
router.post('/mfa/enable', protect, authController.enableMfa);
router.post('/mfa/verify', protect, [body('totpCode').isLength({ min: 6, max: 6 }).isNumeric()], validate, authController.verifyMfa);
router.post('/mfa/disable', protect, [body('totpCode').isLength({ min: 6, max: 6 }).isNumeric()], validate, authController.disableMfa);

module.exports = router;
