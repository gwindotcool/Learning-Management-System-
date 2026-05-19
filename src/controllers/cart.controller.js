const { Cart, Coupon, Enrollment } = require('../models/index');
const Course = require('../models/Course.model');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const recalculate = async (cart) => {
  let subtotal = cart.items.reduce((sum, item) => sum + (item.price || 0), 0);
  let discount = 0;

  if (cart.coupon) {
    const coupon = await Coupon.findById(cart.coupon);
    if (coupon?.isActive && !(coupon.expiresAt && coupon.expiresAt < new Date())) {
      discount = coupon.type === 'percentage'
        ? (subtotal * coupon.value) / 100
        : Math.min(coupon.value, subtotal);
    } else {
      cart.coupon = undefined;
      cart.couponCode = undefined;
    }
  }

  cart.discount = Math.round(discount * 100) / 100;
  cart.total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
};

exports.getCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id })
    .populate({
      path: 'items.course',
      select: 'title thumbnail slug price isFree stats level instructor',
      populate: { path: 'instructor', select: 'name' },
    });

  if (!cart) return res.json({ success: true, data: { items: [], subtotal: 0, discount: 0, total: 0 } });

  const subtotal = cart.items.reduce((s, i) => s + (i.price || 0), 0);
  res.json({ success: true, data: { items: cart.items, couponCode: cart.couponCode, subtotal, discount: cart.discount, total: cart.total } });
});

exports.addToCart = catchAsync(async (req, res) => {
  const { courseId } = req.body;
  const course = await Course.findOne({ _id: courseId, status: 'published' });
  if (!course) throw new AppError('Course not found', 404);

  const alreadyEnrolled = await Enrollment.exists({ student: req.user._id, course: courseId });
  if (alreadyEnrolled) throw new AppError('You are already enrolled in this course', 400);

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = new Cart({ user: req.user._id, items: [] });

  if (cart.items.some(i => i.course.toString() === courseId)) {
    throw new AppError('Course is already in your cart', 400);
  }

  cart.items.push({ course: courseId, price: course.price });
  await recalculate(cart);
  await cart.save();

  res.status(201).json({ success: true, message: 'Course added to cart', data: { itemCount: cart.items.length, total: cart.total } });
});

exports.removeFromCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found', 404);

  const before = cart.items.length;
  cart.items = cart.items.filter(i => i.course.toString() !== req.params.courseId);
  if (cart.items.length === before) throw new AppError('Course not found in cart', 404);

  await recalculate(cart);
  await cart.save();
  res.json({ success: true, message: 'Course removed from cart', data: { total: cart.total } });
});

exports.clearCart = catchAsync(async (req, res) => {
  await Cart.findOneAndUpdate(
    { user: req.user._id },
    { items: [], coupon: undefined, couponCode: undefined, total: 0, discount: 0 }
  );
  res.json({ success: true, message: 'Cart cleared' });
});

exports.applyCoupon = catchAsync(async (req, res) => {
  const { code } = req.body;
  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim(), isActive: true });
  if (!coupon) throw new AppError('Invalid coupon code', 400);
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError('Coupon has expired', 400);
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new AppError('Coupon usage limit reached', 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw new AppError('Your cart is empty', 400);

  if (coupon.minOrderAmount) {
    const subtotal = cart.items.reduce((s, i) => s + i.price, 0);
    if (subtotal < coupon.minOrderAmount) throw new AppError(`Minimum order amount of $${coupon.minOrderAmount} required`, 400);
  }

  cart.coupon = coupon._id;
  cart.couponCode = coupon.code;
  await recalculate(cart);
  await cart.save();

  res.json({ success: true, message: 'Coupon applied', data: { discount: cart.discount, total: cart.total, couponCode: cart.couponCode } });
});

exports.removeCoupon = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found', 404);

  cart.coupon = undefined;
  cart.couponCode = undefined;
  await recalculate(cart);
  await cart.save();

  res.json({ success: true, message: 'Coupon removed', data: { total: cart.total } });
});
