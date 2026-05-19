const slugify = require('slugify');
const { Category, Tag } = require('../models/index');
const Course = require('../models/Course.model');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// ─── CATEGORIES ────────────────────────────────────────────────────────────────
exports.getAllCategories = catchAsync(async (req, res) => {
  const categories = await Category.find({ parent: null })
    .populate({ path: 'subcategories', select: 'name slug courseCount' })
    .sort('name');
  res.json({ success: true, data: categories });
});

exports.getCoursesByCategory = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sort = '-stats.totalStudents' } = req.query;
  const category = await Category.findOne({
    $or: [{ _id: req.params.categoryId }, { slug: req.params.categoryId }],
  });
  if (!category) throw new AppError('Category not found', 404);

  const [courses, total] = await Promise.all([
    Course.find({ category: category._id, status: 'published' })
      .populate('instructor', 'name avatar headline')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(+limit)
      .select('title slug thumbnail price isFree stats level language'),
    Course.countDocuments({ category: category._id, status: 'published' }),
  ]);

  res.json({ success: true, data: courses, meta: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / limit), category } });
});

exports.createCategory = catchAsync(async (req, res) => {
  const slug = slugify(req.body.name, { lower: true, strict: true });
  const category = await Category.create({ ...req.body, slug });
  res.status(201).json({ success: true, data: category });
});

exports.updateCategory = catchAsync(async (req, res) => {
  if (req.body.name) req.body.slug = slugify(req.body.name, { lower: true, strict: true });
  const category = await Category.findByIdAndUpdate(req.params.categoryId, req.body, { new: true, runValidators: true });
  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, data: category });
});

exports.deleteCategory = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.categoryId);
  if (!category) throw new AppError('Category not found', 404);
  const hasCourses = await Course.exists({ category: category._id });
  if (hasCourses) throw new AppError('Cannot delete category with existing courses. Reassign courses first.', 400);
  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});

// ─── TAGS ──────────────────────────────────────────────────────────────────────
exports.getAllTags = catchAsync(async (req, res) => {
  const filter = req.query.search ? { name: new RegExp(req.query.search, 'i') } : {};
  const tags = await Tag.find(filter).sort('name').limit(200).select('name slug');
  res.json({ success: true, data: tags });
});

exports.createTag = catchAsync(async (req, res) => {
  const slug = slugify(req.body.name, { lower: true, strict: true });
  const tag = await Tag.create({ name: req.body.name.toLowerCase().trim(), slug });
  res.status(201).json({ success: true, data: tag });
});

exports.deleteTag = catchAsync(async (req, res) => {
  const tag = await Tag.findByIdAndDelete(req.params.tagId);
  if (!tag) throw new AppError('Tag not found', 404);
  res.json({ success: true, message: 'Tag deleted' });
});
