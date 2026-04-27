import { config } from '../config/env';
import { httpClient } from '../utils/http-client';
import { tokenService } from './token-service';
import { RedisService } from 'ondc-automation-cache-lib';
import {
  ConsentGenerateRequest,
  ConsentGenerateResponse,
  ConsentVerifyRequest,
  ConsentVerifyResponse,
  FinvuAPIResponse
} from '../types/finvu-aa-types';
import logger from '@ondc/automation-logger';
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
    logger.info('🚀 generateConsentHandler called', {
      custId: request.custId,
      templateName: request.templateName,
      timestamp: new Date().toISOString(),
      requestDetails: JSON.stringify(request)
    });

    const token = await tokenService.getToken();

    const templateName = "CT003_Monitoring"
    const consentDescription = request.consentDescription || config.finvu.consentDescription;
    const redirectUrl = request.redirectUrl || "https://google.co.in";

    logger.info('📋 Using configuration', {
      templateName,
      consentDescription,
      redirectUrl,
      aaId: config.finvu.aaId
    });

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

      logger.info('📡 Calling Finvu API ConsentRequestPlus', {
        url: `${config.finvu.baseUrl}/ConsentRequestPlus`,
        custId: request.custId,
        requestBodySample: {
          header: requestBody.header,
          custId: requestBody.body.custId,
          templateName: requestBody.body.templateName
        }
      });

      const response = await httpClient.post<FinvuAPIResponse>(
        `${config.finvu.baseUrl}/ConsentRequestPlus`,
        requestBody,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      logger.info('✅ Finvu API response received', {
        consentHandler: response.body.ConsentHandle,
        hasUrl: !!response.body.url,
        responseTimestamp: new Date().toISOString()
      });

      const result: ConsentGenerateResponse = {
        consentHandler: response.body.ConsentHandle,
        encryptedRequest: response.body.encryptedRequest,
        requestDate: response.body.requestDate,
        encryptedFiuId: response.body.encryptedFiuId,
        url: response.body.url
      };

      logger.info('✨ Consent handler generated successfully - RETURNING NEW HANDLER', {
        custId: request.custId,
        consentHandler: result.consentHandler,
        consentHandlerLength: result.consentHandler?.length,
        timestamp: new Date().toISOString()
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
    logger.info('verifyConsentHandler called', JSON.stringify(request));

    const token = await tokenService.getToken();

    // ========== GET SESSION DATA FROM REDIS ==========
    let sessionData = null;
    const transactionId = request?.transactionId;
    const uiSessionId = request?.sessionId;

    logger.info('verifyConsentHandler called', { transactionId, uiSessionId });

    if (transactionId) {
      let resolvedKey = transactionId;

      if (uiSessionId) {
        logger.info('Fetching ui-session-data from Redis', { uiSessionId });
        try {
          const uiSessionRaw = await RedisService.getKey(uiSessionId);
          logger.info('ui-session-data raw value', { uiSessionId, found: !!uiSessionRaw, value: uiSessionRaw });

          if (uiSessionRaw) {
            const uiSessionData = JSON.parse(uiSessionRaw);
            logger.info('ui-session-data parsed', { uiSessionData });

            const subUrl = uiSessionData?.subscriberUrl;
            logger.info('subscriberUrl extracted from ui-session-data', { subUrl });

            if (subUrl) {
              resolvedKey = `MOCK_DATA::${transactionId}::${subUrl}`;
              logger.info('Resolved composite Redis key', { resolvedKey });
            } else {
              logger.info('subscriberUrl not found — using bare transactionId', { resolvedKey });
            }
          } else {
            logger.info('ui-session-data not found in Redis — using bare transactionId', { uiSessionId, resolvedKey });
          }
        } catch (uiErr: any) {
          logger.error('Error fetching ui-session-data', { uiSessionId, error: uiErr.message });
        }
      } else {
        logger.info('No sessionId provided — using transactionId directly', { resolvedKey });
      }

      logger.info('Fetching session data with key', { resolvedKey });
      sessionData = await sessionService.getSessionData(resolvedKey);
      logger.info('Session data fetched', {
        resolvedKey,
        found: !!sessionData,
        transaction_id: sessionData?.transaction_id,
        hasConsentHandler: !!sessionData?.consent_handler,
        hasFormData: !!sessionData?.form_data
      });
    } else {
      logger.info('No transactionId provided — cannot fetch session data');
    }

    // let dedicatedFormData: any = null;
    // if (transactionId) {
    //   const dedicatedKey = `form_data_${transactionId}`;
    //   const dedicatedRaw = await RedisService.getKey(dedicatedKey);
    //   dedicatedFormData = dedicatedRaw ? JSON.parse(dedicatedRaw) : null;
    //   logger.info("dedicatedFormData from form_data_ key+++++++++", dedicatedFormData);
    // }

    const lspId = config.finvu.lspId || "loanseva";
    const returnUrl = `${config.finvu.returnUrl}?session_id=${uiSessionId}&transaction_id=${transactionId}`;
    const redirectUrl = config.finvu.redirectUrl;
    // Support both gold loan (consumer_information_form) and personal loan (personal_loan_information_form)

    const contactNumber =
      sessionData?.form_data?.personal_loan_information_form?.contactNumber ||
      sessionData?.form_data?.consumer_information_form?.contactNumber ||
      sessionData?.form_data?.personal_details_information_form?.contactNumber;

    logger.info("sessionData?.form_data", sessionData?.form_data);
    logger.info("sessionData?.form_data?.personal_loan_information_form", sessionData?.form_data?.personal_loan_information_form);
    logger.info("contactNumber in finvu service using dedicated FormData and fallback", contactNumber);
    logger.info('Contact number in finvu service', { contactNumber });

    const cust_id = contactNumber ? contactNumber + "@finvu" : "6284870148@finvu";
    const consentHandles = sessionData?.consent_handler
      ? sessionData.consent_handler
      : ["71bdc3ac-c310-4232-ab1d-36184bb61442"];


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

    logger.info("RequestBody: ", requestBody)

    try {
      logger.info('Verifying consent handler', {
        userId: cust_id,
        consentHandles: sessionData?.consent_handler ? sessionData.consent_handler : [],
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
        url: response.body.url ? response.body.url.replace('https://sdkredirect.finvu.in', 'https://reactjssdk.finvu.in') : response.body.url
      };


      logger.info('Consent handler verified successfully', {
        userId: request.userId,
        url: result.url
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to verify consent handler', {
        sessionData: JSON.stringify(sessionData),
        error: error.message
      });
      throw new Error(`Failed to verify consent handler: ${error.message}`);
    }
  }
}

export const finvuAAService = new FinvuAAService();

