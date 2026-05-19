const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/category.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { body, param } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

router.get('/categories', ctrl.getAllCategories);
router.get('/categories/:categoryId/courses', [param('categoryId').notEmpty().isMongoId()], validate, ctrl.getCoursesByCategory);
router.post('/admin/categories', protect, restrictTo('admin'), [body('name').notEmpty().trim()], validate, ctrl.createCategory);
router.put('/admin/categories/:categoryId', protect, restrictTo('admin'), [param('categoryId').notEmpty().isMongoId()], validate, ctrl.updateCategory);
router.delete('/admin/categories/:categoryId', protect, restrictTo('admin'), [param('categoryId').notEmpty().isMongoId()], validate, ctrl.deleteCategory);
router.get('/tags', ctrl.getAllTags);
router.post('/admin/tags', protect, restrictTo('admin'), [body('name').notEmpty().trim()], validate, ctrl.createTag);
router.delete('/admin/tags/:tagId', protect, restrictTo('admin'), [param('tagId').notEmpty().isMongoId()], validate, ctrl.deleteTag);

module.exports = router;
