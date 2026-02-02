import { Request, Response } from 'express';
import { finvuAAService } from '../services/finvu-aa-service';
import logger from '../utils/logger';
import { RedisService } from 'ondc-automation-cache-lib';

export const generateConsentHandler = async (req: Request, res: Response) => {
  try {
    logger.info('🔵 Incoming request to /consent/generate', {
      timestamp: new Date().toISOString(),
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });

    const { custId, templateName, consentDescription, redirectUrl } = req.body;

    if (!custId) {
      logger.error('❌ Bad request - missing custId', { body: req.body });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'custId is required'
      });
    }

    logger.info('➡️ Calling finvuAAService.generateConsentHandler', { custId, templateName });

    const result = await finvuAAService.generateConsentHandler({
      custId,
      templateName,
      consentDescription,
      redirectUrl
    });

    logger.info('✅ Successfully generated consent, sending response', {
      consentHandler: result.consentHandler,
      hasUrl: !!result.url
    });

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Generate consent handler failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

export const verifyConsentHandler = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      consentHandles,
      lspId,
      returnUrl,
      redirectUrl,
      transactionId
    } = req.body;

    // Support both query params and body for session identifiers
    const sessionKey = transactionId ||
      req.query.transaction_id;

    // if (!userId || !consentHandles || !Array.isArray(consentHandles)) {
    //   return res.status(400).json({
    //     error: 'Bad Request',
    //     message: 'userId and consentHandles (array) are required'
    //   });
    // }

    const result = await finvuAAService.verifyConsentHandler({
      userId,
      consentHandles,
      lspId,
      returnUrl,
      redirectUrl,
      transactionId: sessionKey as string
    });

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Verify consent handler failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

export const healthCheck = async (req: Request, res: Response) => {
  try {
    // Check Redis connection
    const testKey = '__health_check__';
    let redisStatus = 'OK';
    let redisError = null;

    try {
      const setResult = await RedisService.setKey(testKey, 'OK', 5);
      if (!setResult) {
        redisStatus = 'UNHEALTHY';
        redisError = 'Failed to set key';
      } else {
        await RedisService.deleteKey(testKey);
      }
    } catch (error: any) {
      redisStatus = 'UNHEALTHY';
      redisError = error.message;
    }

    const isHealthy = redisStatus === 'OK';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? 'OK' : 'UNHEALTHY',
      service: 'automation-finvu-aa-service',
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: {
          status: redisStatus,
          error: redisError
        }
      }
    });
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'UNHEALTHY',
      service: 'automation-finvu-aa-service',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

