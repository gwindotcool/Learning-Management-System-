const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: process.env.EMAIL_PORT === '465',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const FROM = process.env.EMAIL_FROM || 'LMS Academy <noreply@lmsacademy.com>';

// ─── Base HTML template ───────────────────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f1f5f9; }
    .container { max-width:600px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#0f172a; padding:32px; text-align:center; }
    .header h1 { color:#f59e0b; margin:0; font-size:22px; letter-spacing:2px; }
    .body { padding:40px 48px; }
    .body h2 { color:#0f172a; font-size:20px; margin-top:0; }
    .body p { color:#475569; line-height:1.7; font-size:15px; }
    .btn { display:inline-block; background:#f59e0b; color:#0f172a !important; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; font-size:15px; margin:20px 0; }
    .code { background:#f1f5f9; border-left:4px solid #f59e0b; padding:16px 20px; border-radius:8px; font-family:monospace; font-size:18px; color:#0f172a; letter-spacing:3px; margin:20px 0; text-align:center; }
    .footer { background:#f8fafc; padding:24px 48px; text-align:center; color:#94a3b8; font-size:12px; border-top:1px solid #e2e8f0; }
    .divider { height:1px; background:#e2e8f0; margin:24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>TS ACADEMY</h1></div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} TS Academy LMS. All rights reserved.</p>
      <p>This email was sent to you because you have an account with us.</p>
    </div>
  </div>
</body>
</html>`;

// ─── Send helper ──────────────────────────────────────────────────────────────
const sendMail = async ({ to, subject, html }) => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    logger.error(`Email failed to ${to}:`, err.message);
  }
};

// ─── Email: Verification ───────────────────────────────────────────────────────
exports.sendVerificationEmail = async (email, name, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  await sendMail({
    to: email,
    subject: 'Verify your email — TS Academy',
    html: baseTemplate(`
      <h2>Welcome, ${name}! 👋</h2>
      <p>Thanks for signing up. Please verify your email address to get started.</p>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <a href="${url}" class="btn">Verify Email Address</a>
      <div class="divider"></div>
      <p style="font-size:13px;color:#94a3b8;">Or copy this link:<br><span style="word-break:break-all;">${url}</span></p>
    `),
  });
};

// ─── Email: Password Reset ─────────────────────────────────────────────────────
exports.sendPasswordResetEmail = async (email, name, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  await sendMail({
    to: email,
    subject: 'Reset your password — TS Academy',
    html: baseTemplate(`
      <h2>Reset your password</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below. This link expires in <strong>1 hour</strong>.</p>
      <a href="${url}" class="btn">Reset Password</a>
      <div class="divider"></div>
      <p style="font-size:13px;color:#94a3b8;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
    `),
  });
};

// ─── Email: Enrollment Confirmation ───────────────────────────────────────────
exports.sendEnrollmentConfirmation = async (email, name, courseTitle) => {
  const url = `${process.env.FRONTEND_URL}/my-courses`;
  await sendMail({
    to: email,
    subject: `You're enrolled in "${courseTitle}" — TS Academy`,
    html: baseTemplate(`
      <h2>Enrollment Confirmed! 🎉</h2>
      <p>Hi ${name},</p>
      <p>You are now enrolled in <strong>${courseTitle}</strong>. Start learning at your own pace.</p>
      <a href="${url}" class="btn">Go to My Courses</a>
    `),
  });
};

// ─── Email: Generic Notification ──────────────────────────────────────────────
exports.sendNotificationEmail = async (userId, { title, message }) => {
  try {
    const User = require('../models/User.model');
    const user = await User.findById(userId).select('email name');
    if (!user) return;
    await sendMail({
      to: user.email,
      subject: `${title} — TS Academy`,
      html: baseTemplate(`
        <h2>${title}</h2>
        <p>${message}</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Go to Dashboard</a>
      `),
    });
  } catch (err) {
    logger.error('Notification email error:', err.message);
  }
};

// ─── Email: Course Approved ───────────────────────────────────────────────────
exports.sendCourseApprovedEmail = async (email, name, courseTitle, courseSlug) => {
  const url = `${process.env.FRONTEND_URL}/course/${courseSlug}`;
  await sendMail({
    to: email,
    subject: `Your course "${courseTitle}" is now live! — TS Academy`,
    html: baseTemplate(`
      <h2>Your course is live! 🚀</h2>
      <p>Hi ${name},</p>
      <p>Congratulations! Your course <strong>${courseTitle}</strong> has been approved and is now available to students.</p>
      <a href="${url}" class="btn">View Course</a>
    `),
  });
};
