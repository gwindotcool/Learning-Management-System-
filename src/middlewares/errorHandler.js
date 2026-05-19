// ─── Error Handler Middleware ─────────────────────────────────────────────────
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`${field} already exists. Please use a different value.`, 409);
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(e => e.message);
  return new AppError(`Validation failed: ${errors.join('. ')}`, 422);
};

const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401);
};

const handleJWTExpiredError = () => {
  return new AppError('Your session has expired. Please log in again.', 401);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    success: false,
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      // RFC 7807 Problem Details
      type: 'about:blank',
      title: err.status === 'fail' ? 'Request Error' : 'Server Error',
      status: err.statusCode,
      detail: err.message,
    });
  } else {
    logger.error('UNHANDLED ERROR:', err);
    res.status(500).json({
      success: false,
      type: 'about:blank',
      title: 'Server Error',
      status: 500,
      detail: 'An unexpected error occurred. Please try again later.',
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error(`${err.statusCode} ${req.method} ${req.originalUrl} — ${err.message}`);

  let error = { ...err, message: err.message };

  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  if (process.env.NODE_ENV === 'development') return sendErrorDev(error, res);
  sendErrorProd(error, res);
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: `Cannot ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFound };
