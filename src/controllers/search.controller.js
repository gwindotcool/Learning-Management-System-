const Course = require('../models/Course.model');
const User = require('../models/User.model');
const { Category } = require('../models/index');
const catchAsync = require('../utils/catchAsync');

exports.search = catchAsync(async (req, res) => {
  const { q, type, category, level, minPrice, maxPrice, rating, page = 1, limit = 20, sort = '-stats.totalStudents' } = req.query;
  if (!q || q.trim().length < 2) return res.json({ success: true, data: { courses: [], instructors: [], categories: [] } });

  const regex = new RegExp(q.trim(), 'i');
  const skip = (page - 1) * limit;

  // Build course filter
  const courseFilter = {
    status: 'published',
    $or: [{ title: regex }, { description: regex }, { shortDescription: regex }],
  };
  if (category) courseFilter.category = category;
  if (level) courseFilter.level = level;
  if (minPrice !== undefined || maxPrice !== undefined) {
    courseFilter.price = {};
    if (minPrice !== undefined) courseFilter.price.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) courseFilter.price.$lte = parseFloat(maxPrice);
  }
  if (rating) courseFilter['stats.averageRating'] = { $gte: parseFloat(rating) };

  const [courses, courseTotal, instructors, categories] = await Promise.all([
    !type || type === 'course'
      ? Course.find(courseFilter)
          .populate('instructor', 'name avatar headline')
          .populate('category', 'name slug')
          .sort(sort)
          .skip(skip)
          .limit(+limit)
          .select('title slug thumbnail price isFree stats level language category instructor')
      : [],
    !type || type === 'course'
      ? Course.countDocuments(courseFilter)
      : 0,
    !type || type === 'instructor'
      ? User.find({ role: 'instructor', $or: [{ name: regex }, { bio: regex }, { headline: regex }] })
          .select('name avatar headline bio')
          .limit(10)
      : [],
    !type || type === 'category'
      ? Category.find({ name: regex }).select('name slug courseCount').limit(8)
      : [],
  ]);

  res.json({
    success: true,
    data: { courses, instructors, categories },
    meta: { query: q, page: +page, limit: +limit, courseTotal, totalPages: Math.ceil(courseTotal / limit) },
  });
});

exports.getSuggestions = catchAsync(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ success: true, data: [] });

  const [courses, categories] = await Promise.all([
    Course.find({ status: 'published', title: new RegExp(q, 'i') })
      .select('title slug')
      .limit(6),
    Category.find({ name: new RegExp(q, 'i') })
      .select('name slug')
      .limit(3),
  ]);

  const suggestions = [
    ...courses.map(c => ({ type: 'course', label: c.title, slug: c.slug })),
    ...categories.map(c => ({ type: 'category', label: c.name, slug: c.slug })),
  ];

  res.json({ success: true, data: suggestions });
});

exports.getFilters = catchAsync(async (req, res) => {
  const [categories, levels, languages] = await Promise.all([
    Category.find({ parent: null }).select('name slug').sort('name'),
    ['beginner', 'intermediate', 'advanced', 'all-levels'],
    Course.distinct('language', { status: 'published' }),
  ]);

  res.json({
    success: true,
    data: {
      categories,
      levels,
      languages,
      ratings: [4.5, 4.0, 3.5, 3.0],
      priceRanges: [
        { label: 'Free', min: 0, max: 0 },
        { label: 'Under $20', min: 0.01, max: 20 },
        { label: '$20 – $50', min: 20, max: 50 },
        { label: 'Over $50', min: 50, max: null },
      ],
    },
  });
});
