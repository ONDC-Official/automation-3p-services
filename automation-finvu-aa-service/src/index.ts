import { createServer, checkRedisConnection } from './server';
import { config } from './config/env';
import logger from './utils/logger';

/**
 * Start the server with Redis health check
 */
const startServer = async () => {
  try {
    // Check Redis connection before starting the server
    await checkRedisConnection();
    
    const app = createServer();
    
    const server = app.listen(config.port, () => {
      logger.info(`Finvu AA Service running on ${config.host}:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Finvu Base URL: ${config.finvu.baseUrl}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();
