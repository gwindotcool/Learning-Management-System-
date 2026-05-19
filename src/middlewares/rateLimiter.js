const rateLimit = require('express-rate-limit');

const createLimiter = (max, windowMin = 1, message) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: message || `Too many requests. Limit: ${max} per ${windowMin}min.` },
    skip: (req) => process.env.NODE_ENV === 'test',
  });

const authLimiter = createLimiter(
  parseInt(process.env.RATE_LIMIT_AUTH, 10) || 100,
  1,
  'Too many requests from this IP. Please try again in a minute.'
);

const publicLimiter = createLimiter(
  parseInt(process.env.RATE_LIMIT_PUBLIC, 10) || 20,
  1,
  'Too many public requests. Please try again later.'
);

const strictLimiter = createLimiter(5, 15, 'Too many attempts. Please try again in 15 minutes.');

module.exports = { authLimiter, publicLimiter, strictLimiter };
