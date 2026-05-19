const multer = require('multer');
const { AppError } = require('../utils/AppError');

const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new AppError('Only image files are allowed (JPEG, PNG, WEBP, GIF)', 400), false);
};

const videoFilter = (req, file, cb) => {
  const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('Only video files are allowed (MP4, MOV, AVI, WEBM)', 400), false);
};

const documentFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('Only PDF, TXT, DOCX files are allowed', 400), false);
};

const captionFilter = (req, file, cb) => {
  const allowed = ['text/vtt', 'application/x-subrip', 'text/plain'];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(vtt|srt)$/i)) {
    return cb(null, true);
  }
  cb(new AppError('Only VTT or SRT caption files are allowed', 400), false);
};

exports.uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('image');

exports.uploadAvatar = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}).single('avatar');

exports.uploadThumbnail = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('thumbnail');

exports.uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
}).single('video');

exports.uploadAttachment = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}).single('file');

exports.uploadCaption = multer({
  storage,
  fileFilter: captionFilter,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
}).single('captionFile');
