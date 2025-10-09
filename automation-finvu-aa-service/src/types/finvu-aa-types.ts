export interface LoginRequest {
  userId: string;
  password: string;
}

export interface LoginResponse {
  header: {
    rid: string;
    ts: string;
    channelId: string;
  };
  body: {
    token: string;
  };
}

export interface ConsentGenerateRequest {
  custId: string;
  templateName?: string;
  fiTypes?: string[];
  consentDescription?: string;
  redirectUrl?: string;
  purpose?: {
    Category?: {
      type?: string;
    };
    code?: string;
    refUri?: string;
    text?: string;
  };
  fip?: string[];
}

export interface ConsentGenerateResponse {
  consentHandler: string;
  encryptedRequest: string;
  requestDate: string;
  encryptedFiuId: string;
  url: string;
}

export interface ConsentVerifyRequest {
  userId: string;
  consentHandles: string[];
  lspId?: string;
  returnUrl?: string;
  redirectUrl?: string;
  sessionId?: string; // For Redis session lookup
  transactionId?: string; // Alternative session identifier
}

export interface ConsentVerifyResponse {
  url: string;
}

export interface FinvuAPIRequest {
  header: {
    rid: string;
    ts: string;
    channelId: string;
  };
  body: any;
}

export interface FinvuAPIResponse {
  header: {
    rid: string;
    ts: string;
    channelId: string;
  };
  body: any;
}

