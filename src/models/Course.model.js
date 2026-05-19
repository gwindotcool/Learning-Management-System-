const mongoose = require('mongoose');
const slugify = require('slugify');

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    slug: { type: String, unique: true, index: true },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    shortDescription: { type: String, maxlength: [300, 'Short description cannot exceed 300 characters'] },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
    thumbnail: { url: String, publicId: String },
    promoVideo: { url: String, publicId: String, duration: Number },
    price: { type: Number, required: true, min: 0, default: 0 },
    comparePrice: { type: Number, min: 0 },
    currency: { type: String, default: 'USD' },
    isFree: { type: Boolean, default: false },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'all-levels'],
      default: 'all-levels',
    },
    language: { type: String, default: 'English' },
    status: {
      type: String,
      enum: ['draft', 'pending', 'published', 'rejected', 'archived'],
      default: 'draft',
      index: true,
    },
    rejectionReason: String,
    isFeatured: { type: Boolean, default: false },
    requirements: [String],
    objectives: [String],
    targetAudience: [String],
    // Aggregated stats (updated via hooks)
    stats: {
      totalStudents: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalLectures: { type: Number, default: 0 },
      totalDuration: { type: Number, default: 0 }, // seconds
      totalSections: { type: Number, default: 0 },
    },
    publishedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
courseSchema.index({ title: 'text', description: 'text', shortDescription: 'text' });
courseSchema.index({ 'stats.averageRating': -1 });
courseSchema.index({ 'stats.totalStudents': -1 });
courseSchema.index({ createdAt: -1 });
courseSchema.index({ price: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
courseSchema.virtual('sections', {
  ref: 'Section',
  localField: '_id',
  foreignField: 'course',
  options: { sort: { order: 1 } },
});

// ─── Pre-save: generate slug ───────────────────────────────────────────────────
courseSchema.pre('save', async function (next) {
  if (!this.isModified('title')) return next();
  let slug = slugify(this.title, { lower: true, strict: true });
  const existing = await this.constructor.findOne({ slug });
  if (existing && existing._id.toString() !== this._id.toString()) {
    slug = `${slug}-${Date.now()}`;
  }
  this.slug = slug;
  this.isFree = this.price === 0;
  next();
});

module.exports = mongoose.model('Course', courseSchema);
