// ─── Section Model ────────────────────────────────────────────────────────────
const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  order: { type: Number, required: true, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true } });

sectionSchema.virtual('lectures', {
  ref: 'Lecture',
  localField: '_id',
  foreignField: 'section',
  options: { sort: { order: 1 } },
});

const Section = mongoose.model('Section', sectionSchema);

// ─── Lecture Model ────────────────────────────────────────────────────────────
const lectureSchema = new mongoose.Schema({
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['video', 'article', 'quiz'], default: 'video' },
  order: { type: Number, required: true, default: 0 },
  description: String,
  isFree: { type: Boolean, default: false },
  video: {
    url: String,
    publicId: String,
    duration: Number,
    hlsUrl: String,
    dashUrl: String,
    status: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'pending' },
  },
  article: { content: String },
  attachments: [{
    name: String,
    url: String,
    publicId: String,
    size: Number,
    mimeType: String,
  }],
  captions: [{
    language: String,
    url: String,
    publicId: String,
  }],
}, { timestamps: true });

const Lecture = mongoose.model('Lecture', lectureSchema);

// ─── Enrollment Model ─────────────────────────────────────────────────────────
const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  completedLectures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' }],
  lecturePositions: { type: Map, of: Number, default: {} }, // lectureId -> positionSeconds
  completionPercentage: { type: Number, default: 0 },
  isCompleted: { type: Boolean, default: false },
  completedAt: Date,
  certificateIssued: { type: Boolean, default: false },
  lastAccessedAt: Date,
}, { timestamps: true });

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// ─── Order Model ──────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courses: [{
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    price: Number,
    instructorShare: Number,
  }],
  subtotal: Number,
  discount: { type: Number, default: 0 },
  total: Number,
  currency: { type: String, default: 'USD' },
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  couponCode: String,
  status: { type: String, enum: ['pending', 'completed', 'refunded', 'failed'], default: 'pending' },
  paymentProvider: { type: String, default: 'stripe' },
  stripeSessionId: String,
  stripePaymentIntentId: String,
  refundedAt: Date,
  refundReason: String,
  invoiceUrl: String,
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// ─── Coupon Model ─────────────────────────────────────────────────────────────
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true },
  maxUses: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }], // empty = all courses
  minOrderAmount: { type: Number, default: 0 },
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Coupon = mongoose.model('Coupon', couponSchema);

// ─── Review Model ─────────────────────────────────────────────────────────────
const reviewSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 2000 },
  instructorResponse: String,
  instructorResponseAt: Date,
  helpfulCount: { type: Number, default: 0 },
  helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isReported: { type: Boolean, default: false },
  reportReason: String,
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

reviewSchema.index({ course: 1, student: 1 }, { unique: true });

reviewSchema.statics.recalculateCourseRating = async function (courseId) {
  const Course = mongoose.model('Course');
  const stats = await this.aggregate([
    { $match: { course: courseId } },
    { $group: { _id: '$course', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (stats.length > 0) {
    await Course.findByIdAndUpdate(courseId, {
      'stats.averageRating': Math.round(stats[0].avgRating * 10) / 10,
      'stats.totalReviews': stats[0].count,
    });
  }
};

reviewSchema.post('save', function () {
  this.constructor.recalculateCourseRating(this.course);
});

const Review = mongoose.model('Review', reviewSchema);

// ─── Category Model ───────────────────────────────────────────────────────────
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  icon: String,
  courseCount: { type: Number, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true } });

categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
});

const Category = mongoose.model('Category', categorySchema);

// ─── Tag Model ────────────────────────────────────────────────────────────────
const tagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, lowercase: true },
  slug: { type: String, unique: true },
}, { timestamps: true });

const Tag = mongoose.model('Tag', tagSchema);

// ─── Quiz Model ───────────────────────────────────────────────────────────────
const quizSchema = new mongoose.Schema({
  lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  passScore: { type: Number, default: 70 }, // percentage
  timeLimitSeconds: Number,
  questions: [{
    question: { type: String, required: true },
    options: [String],
    correctIndex: { type: Number, required: true },
    explanation: String,
    points: { type: Number, default: 1 },
  }],
}, { timestamps: true });

const Quiz = mongoose.model('Quiz', quizSchema);

// ─── QuizAttempt Model ────────────────────────────────────────────────────────
const quizAttemptSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [{ questionIndex: Number, selectedIndex: Number, isCorrect: Boolean }],
  score: Number,
  isPassed: Boolean,
  timeTakenSeconds: Number,
}, { timestamps: true });

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

// ─── Assignment Model ─────────────────────────────────────────────────────────
const assignmentSchema = new mongoose.Schema({
  lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  description: String,
  dueDate: Date,
  maxScore: { type: Number, default: 100 },
  allowedTypes: [String],
}, { timestamps: true });

const Assignment = mongoose.model('Assignment', assignmentSchema);

// ─── Submission Model ─────────────────────────────────────────────────────────
const submissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  textContent: String,
  fileUrl: String,
  filePublicId: String,
  grade: Number,
  feedback: String,
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gradedAt: Date,
  status: { type: String, enum: ['submitted', 'graded', 'returned'], default: 'submitted' },
}, { timestamps: true });

const Submission = mongoose.model('Submission', submissionSchema);

// ─── Certificate Model ────────────────────────────────────────────────────────
const certificateSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
  verificationCode: { type: String, unique: true, required: true },
  pdfUrl: String,
  pdfPublicId: String,
  issuedAt: { type: Date, default: Date.now },
  completionPercentage: Number,
}, { timestamps: true });

certificateSchema.index({ student: 1, course: 1 }, { unique: true });

const Certificate = mongoose.model('Certificate', certificateSchema);

// ─── Wishlist Model ───────────────────────────────────────────────────────────
const wishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
}, { timestamps: true });

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

// ─── Cart Model ───────────────────────────────────────────────────────────────
const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [{ course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, price: Number }],
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  couponCode: String,
  total: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
}, { timestamps: true });

const Cart = mongoose.model('Cart', cartSchema);

// ─── Notification Model ───────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['enrollment', 'review', 'payment', 'course_approved', 'course_rejected',
      'new_lecture', 'payout', 'assignment_graded', 'qa_answer', 'system'],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  isRead: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

// ─── NotificationPreference Model ────────────────────────────────────────────
const notifPrefSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
  inApp: { type: Boolean, default: true },
  types: {
    enrollment: { type: Boolean, default: true },
    review: { type: Boolean, default: true },
    payment: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
  },
}, { timestamps: true });

const NotificationPreference = mongoose.model('NotificationPreference', notifPrefSchema);

// ─── Question Model ───────────────────────────────────────────────────────────
const questionSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 5000 },
  answers: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    body: { type: String, required: true },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isMarkedCorrect: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
  }],
  isResolved: { type: Boolean, default: false },
}, { timestamps: true });

const Question = mongoose.model('Question', questionSchema);

// ─── Payout Model ─────────────────────────────────────────────────────────────
const payoutSchema = new mongoose.Schema({
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  method: { type: String, enum: ['bank', 'paypal'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date,
  rejectionReason: String,
  transactionId: String,
}, { timestamps: true });

const Payout = mongoose.model('Payout', payoutSchema);

// ─── Import New Models ────────────────────────────────────────────────────────
const Achievement = require('./Achievement.model');
const UserAchievement = require('./UserAchievement.model');
const Leaderboard = require('./Leaderboard.model');
const DiscussionForum = require('./DiscussionForum.model');
const ForumReply = require('./ForumReply.model');
const Mentorship = require('./Mentorship.model');
const LiveSession = require('./LiveSession.model');
const LearningPath = require('./LearningPath.model');
const Recommendation = require('./Recommendation.model');
const Analytics = require('./Analytics.model');

module.exports = {
  Section, Lecture, Enrollment, Order, Coupon, Review,
  Category, Tag, Quiz, QuizAttempt, Assignment, Submission,
  Certificate, Wishlist, Cart, Notification, NotificationPreference,
  Question, Payout,
  // New Models for Advanced Features
  Achievement, UserAchievement, Leaderboard,
  DiscussionForum, ForumReply,
  Mentorship, LiveSession, LearningPath,
  Recommendation, Analytics,
};
