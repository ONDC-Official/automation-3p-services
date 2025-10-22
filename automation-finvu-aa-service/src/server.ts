import express, { Application } from 'express';
import cors from 'cors';
import { finvuAARoutes } from './routes/finvu-aa-routes';
import logger from './utils/logger';
import { RedisService } from 'ondc-automation-cache-lib';

// Initialize Redis connection
RedisService.useDb(0);

/**
 * Check if Redis is connected and accessible
 * @throws Error if Redis is not accessible
 */
export const checkRedisConnection = async (): Promise<void> => {
  try {
    logger.info('Checking Redis connection...');
    
    // Try to set and get a test key
    const testKey = '__redis_health_check__';
    const testValue = 'OK';
    
    const setResult = await RedisService.setKey(testKey, testValue, 10); // 10 seconds TTL
    if (!setResult) {
      throw new Error('Failed to set test key in Redis');
    }
    
    const getValue = await RedisService.getKey(testKey);
    if (getValue !== testValue) {
      throw new Error('Failed to retrieve test key from Redis');
    }
    
    // Clean up test key
    await RedisService.deleteKey(testKey);
    
    logger.info('✓ Redis connection successful');
  } catch (error: any) {
    logger.error('✗ Redis connection failed', { error: error.message });
    throw new Error(
      `Redis is not running or not accessible. Please check your Redis server and configuration.\n` +
      `Error: ${error.message}\n` +
      `Make sure REDIS_HOST, REDIS_PORT, REDIS_USERNAME, and REDIS_PASSWORD are configured correctly.`
    );
  }
};

export const createServer = (): Application => {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    next();
  });

  // Routes
  app.use('/finvu-aa', finvuAARoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'automation-finvu-aa-service',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        generate: 'POST /finvu-aa/consent/generate',
        verify: 'POST /finvu-aa/consent/verify',
        health: 'GET /finvu-aa/health'
      }
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`
    });
  });

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  });

  return app;
};

