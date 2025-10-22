import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'FINVU_BASE_URL',
  'FINVU_USER_ID',
  'FINVU_PASSWORD'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

export const config = {
  // Server
  port: process.env.PORT || 3002,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Finvu API
  finvu: {
    baseUrl: process.env.FINVU_BASE_URL!, // V2 base URL
    v1BaseUrl: process.env.FINVU_BASE_URL!.replace('/V2', '/V1'), // Derive V1
    userId: process.env.FINVU_USER_ID!,
    password: process.env.FINVU_PASSWORD!,
    
    // Defaults
    defaultTemplate: process.env.FINVU_DEFAULT_TEMPLATE || 'FINVUDEMO_PERIODIC',
    lspId: process.env.FINVU_LSP_ID || 'loanseva',
    redirectUrl: process.env.FINVU_REDIRECT_URL || 'https://sdkredirect.finvu.in/',
    returnUrl: process.env.FINVU_RETURN_URL || 'http://localhost:8000/buyer/post-aa-consent',
    aaId: process.env.FINVU_AA_ID || 'cookiejar-aa@finvu.in',
    consentDescription: process.env.FINVU_CONSENT_DESCRIPTION || 'Gold Loan Account Aggregator Consent'
  }
};

