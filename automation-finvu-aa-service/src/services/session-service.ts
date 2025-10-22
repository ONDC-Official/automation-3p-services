import { RedisService } from 'ondc-automation-cache-lib';
import logger from '../utils/logger';

export interface SessionData {
  transaction_id?: string;
  message_id?: string;
  customer_id?: string;
  consentHandler?: string;
  consentUrl?: string;
  session_id?: string;
  flow_id?: string;
  domain?: string;
  selected_provider?: any;
  item?: any;
  items?: any[];
  [key: string]: any; // Allow additional fields
}

/**
 * Service for managing Redis session data
 */
class SessionService {
  /**
   * Get session data from Redis
   * @param sessionKey - session_id or transaction_id
   * @returns Session data or null if not found
   */
  async getSessionData(sessionKey: string): Promise<SessionData | null> {
    try {
      logger.info('Fetching session data from Redis', { sessionKey });

      const exists = await RedisService.keyExists(sessionKey);
      if (!exists) {
        logger.info('Session not found in Redis', { sessionKey });
        return null;
      }

      const rawData = await RedisService.getKey(sessionKey);
      if (!rawData) {
        logger.info('Session data is empty', { sessionKey });
        return null;
      }

      const sessionData = JSON.parse(rawData) as SessionData;
      
      logger.info('Session data retrieved successfully', {
        sessionKey,
        hasConsentHandler: !!sessionData.consentHandler,
        hasCustomerId: !!sessionData.customer_id,
        transaction_id: sessionData.transaction_id
      });

      return sessionData;
    } catch (error: any) {
      logger.error('Failed to retrieve session data from Redis', {
        sessionKey,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Update session data in Redis
   * @param sessionKey - session_id or transaction_id
   * @param updates - Partial session data to update
   * @returns true if successful, false otherwise
   */
  async updateSessionData(
    sessionKey: string, 
    updates: Partial<SessionData>
  ): Promise<boolean> {
    try {
      logger.info('Updating session data in Redis', { sessionKey });

      // Get existing session data
      const existingData = await this.getSessionData(sessionKey);
      if (!existingData) {
        logger.info('Cannot update non-existent session', { sessionKey });
        return false;
      }

      // Merge updates
      const updatedData = { ...existingData, ...updates };

      // Save back to Redis
      await RedisService.setKey(sessionKey, JSON.stringify(updatedData));

      logger.info('Session data updated successfully', { 
        sessionKey,
        updatedFields: Object.keys(updates) 
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to update session data in Redis', {
        sessionKey,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Save complete session data to Redis
   * @param sessionKey - session_id or transaction_id
   * @param sessionData - Complete session data object
   * @param ttl - Optional time-to-live in seconds
   * @returns true if successful, false otherwise
   */
  async saveSessionData(
    sessionKey: string, 
    sessionData: SessionData,
    ttl?: number
  ): Promise<boolean> {
    try {
      logger.info('Saving session data to Redis', { sessionKey, ttl });

      await RedisService.setKey(
        sessionKey, 
        JSON.stringify(sessionData),
        ttl
      );

      logger.info('Session data saved successfully', { sessionKey });
      return true;
    } catch (error: any) {
      logger.error('Failed to save session data to Redis', {
        sessionKey,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if session exists in Redis
   * @param sessionKey - session_id or transaction_id
   * @returns true if exists, false otherwise
   */
  async sessionExists(sessionKey: string): Promise<boolean> {
    try {
      return await RedisService.keyExists(sessionKey);
    } catch (error: any) {
      logger.error('Failed to check session existence', {
        sessionKey,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Delete session from Redis
   * @param sessionKey - session_id or transaction_id
   * @returns true if successful, false otherwise
   */
  async deleteSession(sessionKey: string): Promise<boolean> {
    try {
      logger.info('Deleting session from Redis', { sessionKey });
      await RedisService.deleteKey(sessionKey);
      logger.info('Session deleted successfully', { sessionKey });
      return true;
    } catch (error: any) {
      logger.error('Failed to delete session from Redis', {
        sessionKey,
        error: error.message
      });
      return false;
    }
  }
}

export const sessionService = new SessionService();

