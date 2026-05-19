const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const bufferToStream = (buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

const uploadImage = (buffer, folder, options = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], ...options },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    bufferToStream(buffer).pipe(uploadStream);
  });

const uploadVideo = (buffer, folder, options = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'video', chunk_size: 6_000_000, ...options },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    bufferToStream(buffer).pipe(uploadStream);
  });

const uploadPDF = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'raw', format: 'pdf' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    bufferToStream(buffer).pipe(uploadStream);
  });

const uploadRaw = (buffer, folder, filename) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'raw', public_id: filename },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    bufferToStream(buffer).pipe(uploadStream);
  });

const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    require('../utils/logger').error('Cloudinary delete error:', err.message);
  }
};

const getSignedStreamingUrl = (publicId) => {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1hr expiry
  });
};

module.exports = { uploadImage, uploadVideo, uploadPDF, uploadRaw, deleteFile, getSignedStreamingUrl };
