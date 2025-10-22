import { Router } from 'express';
import {
  generateConsentHandler,
  verifyConsentHandler,
  healthCheck
} from '../controllers/finvu-aa-controller';

const router = Router();

/**
 * @route   POST /finvu-aa/consent/generate
 * @desc    Generate consent handler
 * @body    { custId: string, templateName?: string, fiTypes?: string[] }
 */
router.post('/consent/generate', generateConsentHandler);

/**
 * @route   POST /finvu-aa/consent/verify
 * @desc    Verify consent handler and get Finvu URL
 * @body    { userId: string, consentHandles: string[], lspId?: string, returnUrl?: string }
 */
router.post('/consent/verify', verifyConsentHandler);

/**
 * @route   GET /finvu-aa/health
 * @desc    Health check
 */
router.get('/health', healthCheck);

export const finvuAARoutes = router;

