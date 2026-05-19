// ─── auth.middleware.js ───────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) throw new AppError('You are not logged in. Please log in to access this resource.', 401);

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.mfaPending) throw new AppError('MFA verification required', 401);

  const user = await User.findById(decoded.userId);
  if (!user) throw new AppError('The user belonging to this token no longer exists.', 401);
  if (user.status === 'banned') throw new AppError('Your account has been suspended.', 403);

  req.user = user;
  next();
});

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.userId);
    }
  } catch { /* optional — continue unauthenticated */ }
  next();
};

// Alias for restrictTo for flexibility in route definitions
const authorize = restrictTo;

module.exports = { protect, restrictTo, authorize, optionalAuth };
