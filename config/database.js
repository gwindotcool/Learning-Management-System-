const mongoose = require('mongoose');
const logger = require('../src/utils/logger');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  
  if (!mongoUri) {
    logger.error('❌ MongoDB URI not configured. Set MONGO_URI or MONGODB_URI in .env file');
    process.exit(1);
  }

  try {
    logger.info('🔗 Attempting MongoDB connection...');
    logger.info(`📍 Connection string configured (credentials hidden for security)`);
    
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 45000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    logger.info('✅ MongoDB connected successfully');
    logger.info(`📊 Database: ${conn.connection.db.databaseName}`);
    logger.info(`🔗 Host: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err.message);
    });

    return conn;
  } catch (err) {
    logger.error('❌ MongoDB connection failed:', err.message);
    logger.error('📝 Full error:', {
      name: err.name,
      message: err.message,
      code: err.code,
    });
    process.exit(1);
  }
};

module.exports = connectDB;