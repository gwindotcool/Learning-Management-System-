// ─── certificate.routes.js ────────────────────────────────────────────────────
const express = require('express');
const certRouter = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/certificate.controller');

certRouter.post('/generate/:courseId', protect, ctrl.generateCertificate);
certRouter.get('/me', protect, ctrl.getMyCertificates);
certRouter.get('/verify/:verificationCode', ctrl.verifyCertificate);
certRouter.get('/:certificateId', ctrl.getCertificate);
certRouter.get('/:certificateId/download', protect, ctrl.downloadCertificate);

module.exports = certRouter;
