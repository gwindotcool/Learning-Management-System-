const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/search.controller');

router.get('/', ctrl.search);
router.get('/suggestions', ctrl.getSuggestions);
router.get('/filters', ctrl.getFilters);

module.exports = router;
