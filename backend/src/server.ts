import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { logger } from './config/logger';
import mongoose from 'mongoose';

import { startExpirationJobInterval } from './services/expirationJob.service';
import { AutoCheckoutService } from './services/autoCheckout.service';

const server = http.createServer(app);

const startServer = async () => {
  await connectDatabase();
  startExpirationJobInterval(60000); // Check every minute
  AutoCheckoutService.initScheduledCron(); // Scheduled daily 12:00 AM IST auto-checkout

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`❌ Port ${env.PORT} is already in use by another process. Run: taskkill /F /PID <PID>`);
      process.exit(1);
    } else {
      logger.error('Server error:', err);
    }
  });

  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`🚀 NextLib Backend API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
};

const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await mongoose.connection.close(false);
      logger.info('MongoDB connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown if graceful exit times out after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection at Promise:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
