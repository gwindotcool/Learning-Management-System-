const mongoose = require('mongoose');
const os = require('os');

exports.healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'LMS Platform API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: `${Math.round(process.uptime())}s`,
    },
  });
};

exports.readinessCheck = async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[dbState] || 'unknown';
  const isReady = dbState === 1;

  const mem = process.memoryUsage();
  res.status(isReady ? 200 : 503).json({
    success: isReady,
    data: {
      status: isReady ? 'ready' : 'not_ready',
      checks: {
        database: { status: dbStatus, connected: dbState === 1 },
        memory: {
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
          rssMB: Math.round(mem.rss / 1024 / 1024),
          systemFreeMB: Math.round(os.freemem() / 1024 / 1024),
        },
        process: { nodeVersion: process.version, pid: process.pid, platform: process.platform },
      },
    },
  });
};

exports.metrics = (req, res) => {
  const mem = process.memoryUsage();
  const lines = [
    '# HELP nodejs_heap_size_used_bytes Node.js heap memory used',
    '# TYPE nodejs_heap_size_used_bytes gauge',
    `nodejs_heap_size_used_bytes ${mem.heapUsed}`,
    '# HELP nodejs_heap_size_total_bytes Node.js heap memory total',
    '# TYPE nodejs_heap_size_total_bytes gauge',
    `nodejs_heap_size_total_bytes ${mem.heapTotal}`,
    '# HELP nodejs_process_uptime_seconds Process uptime',
    '# TYPE nodejs_process_uptime_seconds counter',
    `nodejs_process_uptime_seconds ${process.uptime()}`,
    '# HELP mongodb_connection_state MongoDB connection state (1=connected)',
    '# TYPE mongodb_connection_state gauge',
    `mongodb_connection_state ${mongoose.connection.readyState}`,
  ];
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(lines.join('\n'));
};
