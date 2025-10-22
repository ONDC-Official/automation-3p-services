# Implementation Guide - Automation Finvu AA Service

## ✅ What Has Been Created

A complete, reusable Finvu Account Aggregator microservice with the following structure:

```
automation-finvu-aa-service/
├── src/
│   ├── config/
│   │   └── env.ts                          # Environment configuration
│   ├── controllers/
│   │   └── finvu-aa-controller.ts          # Request handlers
│   ├── routes/
│   │   └── finvu-aa-routes.ts              # API routes
│   ├── services/
│   │   ├── token-service.ts                # Token management (fresh on every call)
│   │   └── finvu-aa-service.ts             # Core Finvu AA logic
│   ├── types/
│   │   └── finvu-aa-types.ts               # TypeScript interfaces
│   ├── utils/
│   │   ├── logger.ts                       # Logging utility
│   │   └── http-client.ts                  # HTTP client with interceptors
│   ├── server.ts                           # Express server setup
│   └── index.ts                            # Entry point
├── .env.example                            # Environment template
├── .gitignore                              # Git ignore rules
├── .dockerignore                           # Docker ignore rules
├── Dockerfile                              # Container definition
├── docker-compose.yml                      # Docker orchestration
├── package.json                            # Dependencies
├── tsconfig.json                           # TypeScript configuration
├── README.md                               # User documentation
└── IMPLEMENTATION_GUIDE.md                 # This file
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
cd automation-finvu-aa-service
cp .env.example .env
```

Edit `.env` with your Finvu credentials:
```bash
FINVU_BASE_URL=https://dhanaprayoga.fiu.finfactor.in/finsense/API/V2
FINVU_USER_ID=your-actual-user@finvu
FINVU_PASSWORD=your-actual-password
```

### 2. Run the Service

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

**Docker:**
```bash
docker-compose up -d
```

### 3. Test the Service

```bash
# Health check
curl http://localhost:3002/finvu-aa/health

# Generate consent handler
curl -X POST http://localhost:3002/finvu-aa/consent/generate \
  -H "Content-Type: application/json" \
  -d '{"custId": "test@example.com"}'

# Verify consent handler
curl -X POST http://localhost:3002/finvu-aa/consent/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user@example.com",
    "consentHandles": ["your-consent-handler-uuid"]
  }'
```

## 🔧 Integration with Mock Service

### Step 1: Add Environment Variable to Mock Service

Add to mock service `.env`:
```bash
FINVU_AA_SERVICE_URL=http://localhost:3002
```

### Step 2: Create Finvu AA Client in Mock Service

Create a new file in mock service: `src/services/finvu-aa-client.ts`

```typescript
import axios from 'axios';
import logger from '@ondc/automation-logger';

const FINVU_AA_SERVICE_URL = process.env.FINVU_AA_SERVICE_URL || 'http://localhost:3002';

export class FinvuAAClient {
  async generateConsentHandler(custId: string): Promise<string> {
    try {
      const response = await axios.post(
        `${FINVU_AA_SERVICE_URL}/finvu-aa/consent/generate`,
        { custId }
      );
      
      logger.info('Consent handler generated', { 
        custId, 
        consentHandler: response.data.consentHandler 
      });
      
      return response.data.consentHandler;
    } catch (error: any) {
      logger.error('Failed to generate consent handler', { 
        custId, 
        error: error.message 
      });
      throw error;
    }
  }

  async verifyConsentHandler(
    userId: string, 
    consentHandles: string[]
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${FINVU_AA_SERVICE_URL}/finvu-aa/consent/verify`,
        { userId, consentHandles }
      );
      
      logger.info('Consent handler verified', { 
        userId, 
        finvuUrl: response.data.url 
      });
      
      return response.data.url;
    } catch (error: any) {
      logger.error('Failed to verify consent handler', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }
}

export const finvuAAClient = new FinvuAAClient();
```

### Step 3: Update on_select_1 Generator

In `automation-mock-service/src/config/mock-config/FIS12/2.0.2/on_select_1/generator.ts`:

```typescript
import { finvuAAClient } from '../../../../../services/finvu-aa-client';

export async function generateOnSelect1(sessionData: any, inputs?: any) {
  // Generate consent handler dynamically
  const custId = sessionData.custId || sessionData.customer_id || 'default-customer';
  const consentHandler = await finvuAAClient.generateConsentHandler(custId);
  
  // Update response with dynamic consent handler
  const response = {
    // ... your existing response structure
    order: {
      items: [{
        id: "ITEM_ID_PERSONAL_LOAN_2",
        descriptor: {
          code: "PERSONAL_LOAN",
          name: "Personal Loan"
        },
        tags: [{
          descriptor: {
            code: "CONSENT_INFO",
            name: "Consent Information"
          },
          list: [{
            descriptor: {
              code: "CONSENT_HANDLER",
              name: "Consent Handler"
            },
            value: consentHandler // Dynamic consent handler from Finvu
          }],
          display: false
        }]
      }]
    }
  };
  
  return response;
}
```

### Step 4: Add Consent Verification Before select_2

In `automation-mock-service/src/services/state-action-service.ts`:

```typescript
import { finvuAAClient } from './finvu-aa-client';

export async function ValidateAndSaveIncoming(
  req: ApiRequest,
  res: Response,
  next: NextFunction
) {
  // ... existing validation logic
  
  // Add consent verification for select action
  if (req.body.context.action === 'select') {
    const items = req.body.message?.order?.items || [];
    
    for (const item of items) {
      // Extract consent handler from tags
      const consentInfo = item.tags?.find(
        (tag: any) => tag.descriptor?.code === 'CONSENT_INFO'
      );
      
      if (consentInfo) {
        const consentHandlerItem = consentInfo.list?.find(
          (item: any) => item.descriptor?.code === 'CONSENT_HANDLER'
        );
        
        if (consentHandlerItem?.value) {
          // Verify consent handler
          const userId = req.body.context.bap_id;
          const finvuUrl = await finvuAAClient.verifyConsentHandler(
            userId,
            [consentHandlerItem.value]
          );
          
          logger.info('Consent verified, Finvu URL:', finvuUrl);
          
          // Store finvuUrl in session for later use
          await updateConsentVerification(
            req.transactionId,
            req.subscriberUrl,
            { consentHandler: consentHandlerItem.value, finvuUrl, verified: true }
          );
        }
      }
    }
  }
  
  next();
}
```

## 📋 API Reference

### Generate Consent Handler

**Endpoint:** `POST /finvu-aa/consent/generate`

**Request Body:**
```typescript
{
  custId: string;              // Required
  templateName?: string;       // Optional, default: FINVUDEMO_PERIODIC
  fiTypes?: string[];          // Optional, default: from env
  consentDescription?: string; // Optional
  redirectUrl?: string;        // Optional
}
```

**Response:**
```typescript
{
  consentHandler: string;
  encryptedRequest: string;
  requestDate: string;
  encryptedFiuId: string;
  url: string;
}
```

### Verify Consent Handler

**Endpoint:** `POST /finvu-aa/consent/verify`

**Request Body:**
```typescript
{
  userId: string;           // Required
  consentHandles: string[]; // Required
  lspId?: string;          // Optional, default: loanseva
  returnUrl?: string;      // Optional
  redirectUrl?: string;    // Optional
}
```

**Response:**
```typescript
{
  encryptedRequest: string;
  requestDate: string;
  encryptedFiuId: string;
  url: string; // Finvu URL for user redirection
}
```

## 🎯 Key Features

1. **No Caching**: Fresh token from login API on every request
2. **No Token Expiry**: No need to track token expiration
3. **Stateless**: Completely stateless service
4. **Domain Agnostic**: Works for FIS12, FIS14, TRV14, any domain
5. **Environment Driven**: All configuration via environment variables
6. **Simple Integration**: Two endpoints for all consent operations

## 🔍 Troubleshooting

### Service won't start
- Check if `.env` file exists and has required variables
- Verify `FINVU_BASE_URL`, `FINVU_USER_ID`, `FINVU_PASSWORD` are set

### Login fails
- Verify credentials are correct
- Check if Finvu API is accessible
- Review logs: `npm run dev` shows detailed error messages

### Consent generation fails
- Ensure login is successful (check logs)
- Verify `custId` is valid
- Check if template name is correct

### Integration issues
- Verify `FINVU_AA_SERVICE_URL` in mock service points to correct URL
- Check if both services are running
- Review network connectivity between services

## 📦 Dependencies

- `express` - Web framework
- `axios` - HTTP client
- `cors` - CORS middleware
- `dotenv` - Environment variables
- `@ondc/automation-logger` - Logging

## 🚢 Deployment

### Docker Deployment

```bash
# Build image
docker build -t automation-finvu-aa-service .

# Run container
docker run -p 3002:3002 --env-file .env automation-finvu-aa-service

# Using docker-compose
docker-compose up -d
```

### Production Considerations

1. Set `NODE_ENV=production` in environment
2. Use proper secrets management for credentials
3. Configure proper logging
4. Set up monitoring and alerting
5. Use load balancer for high availability

## 📝 Next Steps

1. ✅ Service created and dependencies installed
2. ⏳ Copy `.env.example` to `.env` and configure
3. ⏳ Test service locally
4. ⏳ Integrate with mock service
5. ⏳ Test end-to-end flow
6. ⏳ Deploy to production

## 🎉 Complete!

The automation-finvu-aa-service has been successfully created and is ready for use!

