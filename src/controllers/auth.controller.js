const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User.model');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const emailService = require('../services/email.service');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenHelper');

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = catchAsync(async (req, res) => {
  const { name, email, password, role } = req.body;

  const allowedRoles = ['student', 'instructor'];
  if (role && !allowedRoles.includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already registered', 409);

  const user = await User.create({ name, email, password, role: role || 'student' });

  const verificationToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  await emailService.sendVerificationEmail(user.email, user.name, verificationToken);

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    data: { userId: user._id },
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshTokens +mfaSecret');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.status === 'banned') throw new AppError('Your account has been suspended', 403);

  if (user.mfaEnabled) {
    const tempToken = jwt.sign({ userId: user._id, mfaPending: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
    return res.json({ success: true, data: { mfaRequired: true, tempToken } });
  }

  await sendTokens(user, 200, res);
});

// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { refreshTokens: refreshToken },
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400);

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.userId).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(refreshToken)) {
    throw new AppError('Refresh token not recognized', 401);
  }

  // Rotate refresh token
  const newRefreshToken = generateRefreshToken(user._id);
  user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
  user.refreshTokens.push(newRefreshToken);
  await user.save({ validateBeforeSave: false });

  const accessToken = generateAccessToken(user._id);

  res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
exports.forgotPassword = catchAsync(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    // Don't reveal whether email exists
    return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  }

  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);

  res.json({ success: true, message: 'Password reset email sent.' });
});

// ─── Reset Password ───────────────────────────────────────────────────────────
exports.resetPassword = catchAsync(async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) throw new AppError('Reset token is invalid or has expired', 400);

  user.password = req.body.newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = []; // invalidate all sessions
  await user.save();

  res.json({ success: true, message: 'Password reset successful. Please log in again.' });
});

// ─── Verify Email ─────────────────────────────────────────────────────────────
exports.verifyEmail = catchAsync(async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });
  if (!user) throw new AppError('Verification token is invalid or has expired', 400);

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
});

// ─── Resend Verification ──────────────────────────────────────────────────────
exports.resendVerification = catchAsync(async (req, res) => {
  if (req.user.isEmailVerified) throw new AppError('Email is already verified', 400);

  const verificationToken = req.user.generateEmailVerificationToken();
  await req.user.save({ validateBeforeSave: false });

  await emailService.sendVerificationEmail(req.user.email, req.user.name, verificationToken);

  res.json({ success: true, message: 'Verification email resent.' });
});

// ─── MFA Enable ───────────────────────────────────────────────────────────────
exports.enableMfa = catchAsync(async (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `LMS Academy (${req.user.email})`,
    length: 20,
  });

  req.user.mfaSecret = secret.base32;
  await req.user.save({ validateBeforeSave: false });

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  res.json({ success: true, data: { secret: secret.base32, qrCode: qrCodeUrl } });
});

// ─── MFA Verify (activate) ────────────────────────────────────────────────────
exports.verifyMfa = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('+mfaSecret');
  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: req.body.totpCode,
    window: 1,
  });
  if (!verified) throw new AppError('Invalid TOTP code', 400);

  user.mfaEnabled = true;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'MFA enabled successfully.' });
});

// ─── MFA Disable ─────────────────────────────────────────────────────────────
exports.disableMfa = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('+mfaSecret');
  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: req.body.totpCode,
    window: 1,
  });
  if (!verified) throw new AppError('Invalid TOTP code', 400);

  user.mfaEnabled = false;
  user.mfaSecret = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'MFA disabled.' });
});

// ─── OAuth callback handler ────────────────────────────────────────────────────
exports.oauthCallback = catchAsync(async (req, res) => {
  await sendTokens(req.user, 200, res);
});

// ─── Helper: send access + refresh tokens ────────────────────────────────────
async function sendTokens(user, statusCode, res) {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken]; // keep last 5
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  res.status(statusCode).json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
    },
  });
}
