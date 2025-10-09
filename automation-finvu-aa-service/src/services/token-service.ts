import { config } from '../config/env';
import { httpClient } from '../utils/http-client';
import { LoginResponse } from '../types/finvu-aa-types';
import logger from '../utils/logger';

class TokenService {
  private generateId(): string {
    const randomPart = Math.floor(Math.random() * Math.pow(10, 13))
      .toString()
      .padStart(13, '0');
    return '11' + randomPart;
  }

  private generateTimestamp(): string {
    return new Date().toISOString();
  }

  async getToken(): Promise<string> {
    logger.info('Fetching token from Finvu');
    return await this.login();
  }

  private async login(): Promise<string> {
    const requestBody = {
      header: {
        rid: this.generateId(),
        ts: this.generateTimestamp(),
        channelId: 'finsense'
      },
      body: {
        userId: config.finvu.userId,
        password: config.finvu.password
      }
    };

    try {
      const response = await httpClient.post<LoginResponse>(
        `${config.finvu.baseUrl}/User/Login`,
        requestBody
      );

      if (!response.body?.token) {
        throw new Error('Login failed: No token received from Finvu');
      }

      logger.info('Successfully logged in to Finvu');
      return response.body.token;
    } catch (error: any) {
      logger.error('Finvu login failed', { error: error.message });
      throw new Error(`Finvu login failed: ${error.message}`);
    }
  }
}

export const tokenService = new TokenService();

