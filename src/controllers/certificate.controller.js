const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const { Certificate, Enrollment } = require('../models/index');
const Course = require('../models/Course.model');
const User = require('../models/User.model');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const cloudinaryService = require('../services/cloudinary.service');

const THRESHOLD = parseFloat(process.env.CERTIFICATE_THRESHOLD || 80);

// ─── Check Eligibility ────────────────────────────────────────────────────────
exports.checkEligibility = catchAsync(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  });
  if (!enrollment) throw new AppError('You are not enrolled in this course', 403);

  const isEligible = enrollment.completionPercentage >= THRESHOLD;

  res.json({
    success: true,
    data: {
      isEligible,
      completionPercentage: enrollment.completionPercentage,
      requiredPercentage: THRESHOLD,
      alreadyIssued: enrollment.certificateIssued,
    },
  });
});

// ─── Generate Certificate ─────────────────────────────────────────────────────
exports.generateCertificate = catchAsync(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  });
  if (!enrollment) throw new AppError('You are not enrolled in this course', 403);
  if (enrollment.completionPercentage < THRESHOLD) {
    throw new AppError(`Complete at least ${THRESHOLD}% of the course to earn a certificate`, 400);
  }

  // Idempotent — return existing certificate if already issued
  const existing = await Certificate.findOne({ student: req.user._id, course: req.params.courseId });
  if (existing) return res.json({ success: true, data: existing });

  const [course, student] = await Promise.all([
    Course.findById(req.params.courseId).populate('instructor', 'name'),
    User.findById(req.user._id),
  ]);

  const verificationCode = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16);

  // Generate PDF in memory
  const pdfBuffer = await generateCertificatePDF({
    studentName: student.name,
    courseName: course.title,
    instructorName: course.instructor.name,
    verificationCode,
    completedAt: new Date(),
  });

  // Upload to Cloudinary
  const uploadResult = await cloudinaryService.uploadPDF(pdfBuffer, `lms/certificates/${verificationCode}`);

  const certificate = await Certificate.create({
    student: req.user._id,
    course: req.params.courseId,
    enrollment: enrollment._id,
    verificationCode,
    pdfUrl: uploadResult.secure_url,
    pdfPublicId: uploadResult.public_id,
    completionPercentage: enrollment.completionPercentage,
  });

  enrollment.certificateIssued = true;
  enrollment.isCompleted = true;
  enrollment.completedAt = new Date();
  await enrollment.save();

  res.status(201).json({ success: true, data: certificate });
});

// ─── Get My Certificates ───────────────────────────────────────────────────────
exports.getMyCertificates = catchAsync(async (req, res) => {
  const certificates = await Certificate.find({ student: req.user._id })
    .populate('course', 'title thumbnail slug instructor')
    .sort('-issuedAt');

  res.json({ success: true, data: certificates });
});

// ─── Get Certificate (public) ─────────────────────────────────────────────────
exports.getCertificate = catchAsync(async (req, res) => {
  const certificate = await Certificate.findById(req.params.certificateId)
    .populate('student', 'name')
    .populate('course', 'title instructor')
    .populate({ path: 'course', populate: { path: 'instructor', select: 'name' } });

  if (!certificate) throw new AppError('Certificate not found', 404);

  res.json({ success: true, data: certificate });
});

// ─── Download Certificate PDF ─────────────────────────────────────────────────
exports.downloadCertificate = catchAsync(async (req, res) => {
  const certificate = await Certificate.findOne({
    _id: req.params.certificateId,
    student: req.user._id,
  }).populate('course', 'title').populate('student', 'name');

  if (!certificate) throw new AppError('Certificate not found', 404);

  // Stream existing PDF from storage if available, otherwise generate and cache
  if (certificate.pdfUrl) {
    const response = await fetch(certificate.pdfUrl);
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.verificationCode}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } else {
    // Generate PDF for first-time download
    const course = await Course.findById(certificate.course).populate('instructor', 'name');
    const pdfBuffer = await generateCertificatePDF({
      studentName: certificate.student.name,
      courseName: course.title,
      instructorName: course.instructor.name,
      verificationCode: certificate.verificationCode,
      completedAt: certificate.issuedAt,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.verificationCode}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  }
});

// ─── Verify Certificate (public) ──────────────────────────────────────────────
exports.verifyCertificate = catchAsync(async (req, res) => {
  const certificate = await Certificate.findOne({ verificationCode: req.params.verificationCode })
    .populate('student', 'name')
    .populate('course', 'title instructor')
    .populate({ path: 'course', populate: { path: 'instructor', select: 'name' } });

  if (!certificate) {
    return res.json({ success: true, data: { isValid: false } });
  }

  res.json({
    success: true,
    data: {
      isValid: true,
      studentName: certificate.student.name,
      courseName: certificate.course.title,
      instructorName: certificate.course.instructor?.name,
      issuedAt: certificate.issuedAt,
      completionPercentage: certificate.completionPercentage,
    },
  });
});

// ─── PDF Generator ────────────────────────────────────────────────────────────
function generateCertificatePDF({ studentName, courseName, instructorName, verificationCode, completedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = 841.89;
    const H = 595.28;

    // Background
    doc.rect(0, 0, W, H).fill('#0f172a');

    // Decorative border
    doc.rect(20, 20, W - 40, H - 40)
      .lineWidth(2)
      .stroke('#f59e0b');

    doc.rect(28, 28, W - 56, H - 56)
      .lineWidth(0.5)
      .stroke('#f59e0b');

    // Header
    doc.fillColor('#f59e0b')
      .fontSize(11)
      .font('Helvetica')
      .text('TS ACADEMY', 0, 70, { align: 'center', characterSpacing: 6 });

    doc.fillColor('#ffffff')
      .fontSize(36)
      .font('Helvetica-Bold')
      .text('Certificate of Completion', 0, 100, { align: 'center' });

    // Divider
    doc.moveTo(280, 155).lineTo(W - 280, 155).lineWidth(1).stroke('#f59e0b');

    // Body text
    doc.fillColor('#94a3b8')
      .fontSize(13)
      .font('Helvetica')
      .text('This is to certify that', 0, 175, { align: 'center' });

    doc.fillColor('#f8fafc')
      .fontSize(32)
      .font('Helvetica-Bold')
      .text(studentName, 0, 200, { align: 'center' });

    doc.fillColor('#94a3b8')
      .fontSize(13)
      .font('Helvetica')
      .text('has successfully completed the course', 0, 248, { align: 'center' });

    doc.fillColor('#f59e0b')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(courseName, 60, 272, { align: 'center', width: W - 120 });

    // Date & Instructor row
    const dateStr = completedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
      .text('DATE OF COMPLETION', 100, 360, { characterSpacing: 2 })
      .fillColor('#ffffff').fontSize(12).text(dateStr, 100, 378);

    doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
      .text('INSTRUCTOR', W - 280, 360, { characterSpacing: 2 })
      .fillColor('#ffffff').fontSize(12).text(instructorName, W - 280, 378);

    // Signature line
    doc.moveTo(W - 300, 395).lineTo(W - 100, 395).lineWidth(0.5).stroke('#475569');

    // Verification code
    doc.fillColor('#475569')
      .fontSize(9)
      .font('Helvetica')
      .text(`Verification Code: ${verificationCode}`, 0, H - 55, { align: 'center', characterSpacing: 1 });

    doc.text(`Verify at: ${process.env.FRONTEND_URL || 'https://lmsacademy.com'}/verify/${verificationCode}`, 0, H - 42, { align: 'center' });

    doc.end();
  });
}
