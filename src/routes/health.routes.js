const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/health.controller');

router.get('/health', ctrl.healthCheck);
router.get('/health/ready', ctrl.readinessCheck);
router.get('/health/metrics', ctrl.metrics);

module.exports = router;
