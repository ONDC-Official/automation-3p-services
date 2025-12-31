import { config } from '../config/env';
import { httpClient } from '../utils/http-client';
import { tokenService } from './token-service';
import {
  ConsentGenerateRequest,
  ConsentGenerateResponse,
  ConsentVerifyRequest,
  ConsentVerifyResponse,
  FinvuAPIResponse
} from '../types/finvu-aa-types';
import logger from '../utils/logger';
import { sessionService } from './session-service';

class FinvuAAService {
  private generateId(): string {
    const randomPart = Math.floor(Math.random() * Math.pow(10, 13))
      .toString()
      .padStart(13, '0');
    return '11' + randomPart;
  }

  private generateTimestamp(): string {
    return new Date().toISOString();
  }

  async generateConsentHandler(
    request: ConsentGenerateRequest
  ): Promise<ConsentGenerateResponse> {
    const token = await tokenService.getToken();
    
    const templateName = request.templateName || config.finvu.defaultTemplate;
    const consentDescription = request.consentDescription || config.finvu.consentDescription;
    const redirectUrl = request.redirectUrl || "https://google.co.in";

    // Default Purpose structure as per Finvu API requirements
    const purpose = {
      Category: {
        type: "Financial Reporting"
      },
      code: "101",
      refUri: "https://api.rebit.org.in/aa/purpose/101.xml",
      text: "To offer customized financial products"
    };

    const requestBody = {
      header: {
        rid: this.generateId(),
        ts: this.generateTimestamp(),
        channelId: 'finsense'
      },
      body: {
        aaId: config.finvu.aaId,
        consentDescription,
        ConsentDetails: {
          Purpose: purpose
        },
        custId: request.custId,
        fip: [],
        redirectUrl,
        templateName,
        userSessionId: 'sessionid123'
      }
    };


    try {
      logger.info('Generating consent handler', { custId: request.custId });

      const response = await httpClient.post<FinvuAPIResponse>(
        `${config.finvu.baseUrl}/ConsentRequestPlus`,
        requestBody,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const result: ConsentGenerateResponse = {
        consentHandler: response.body.ConsentHandle,
        encryptedRequest: response.body.encryptedRequest,
        requestDate: response.body.requestDate,
        encryptedFiuId: response.body.encryptedFiuId,
        url: response.body.url
      };

      logger.info('Consent handler generated successfully', {
        custId: request.custId,
        consentHandler: result.consentHandler
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to generate consent handler', {
        custId: request.custId,
        error: error.message
      });
      throw new Error(`Failed to generate consent handler: ${error.message}`);
    }
  }

  async verifyConsentHandler(
    request: ConsentVerifyRequest
  ): Promise<ConsentVerifyResponse> {
    const token = await tokenService.getToken();

    // ========== GET SESSION DATA FROM REDIS ==========
    let sessionData = null;
    const sessionKey = request?.transactionId;
    
    if (sessionKey) {
      sessionData = await sessionService.getSessionData(sessionKey);

      if (sessionData) {
        logger.info('Session data available for consent verification', {
          sessionKey,
          transaction_id: sessionData.transaction_id,
          customer_id: sessionData.customer_id,
          hasConsentHandler: !!sessionData.consentHandler,
          message_id: sessionData.message_id
        });


      }
    }
    
    const lspId = request.lspId || config.finvu.lspId;
    const returnUrl = request.returnUrl || `${config.finvu.returnUrl}?session_id=${sessionData?.session_id}&transaction_id=${sessionData?.transaction_id}`;
    const redirectUrl = request.redirectUrl || config.finvu.redirectUrl;
    // Support both gold loan (consumer_information_form) and personal loan (personal_loan_information_form)
    const contactNumber = sessionData?.form_data?.personal_loan_information_form?.contactNumber
                       || sessionData?.form_data?.consumer_information_form?.contactNumber || sessionData?.form_data?.personal_details_information_form?.contactNumber;
    console.log("sessionData?.form_data?.personal_loan_information_form", sessionData?.form_data);
    console.log("sessionData", sessionData);
    console.log("contactNumber", contactNumber);
    const cust_id = request.userId || (contactNumber ? contactNumber + "@finvu" : undefined);
     //const cust_id = request.userId || sessionData?.form_data?.consumer_information_form?.contactNumber+"@finvu"
      const consentHandles = request.consentHandles || sessionData?.consent_handler ? [sessionData?.consent_handler] : []
      const requestBody = {
        header: {
          ts: this.generateTimestamp(),
          channelId: 'finsense',
          rid: this.generateId()
      },
      body: {
        lspId,
        consentHandles,
        userId: cust_id,
        url: redirectUrl,
        returnUrl
      }
    };

    try {
      logger.info('Verifying consent handler', {
        userId: cust_id,
        consentHandles: sessionData?.consent_handler ? [sessionData.consent_handler] : [],
        hasSessionData: !!sessionData
      });

      const response = await httpClient.post<FinvuAPIResponse>(
        `${config.finvu.baseUrl}/EncryptLspConsentRequest`,
        requestBody,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );


      const result: ConsentVerifyResponse = {

        url: response.body.url
      };


      logger.info('Consent handler verified successfully', {
        userId: request.userId,
        url: result.url
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to verify consent handler', {

        error: error.message
      });
      throw new Error(`Failed to verify consent handler: ${error.message}`);
    }
  }
}

export const finvuAAService = new FinvuAAService();

