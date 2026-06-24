export interface MerchantApplication {
  _id: string;
  name: string;
  code: string;
}

export interface MerchantProfile {
  _id: string;
  applicationId: MerchantApplication | string;
  applicationCode: string;
  externalUserId: string;
  merchantName: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MerchantSessionData {
  sessionToken: string;
  expiresAt: string;
  merchant: MerchantProfile;
}

export interface MerchantApiResponse<T> {
  message?: string;
  data: T;
}

export interface RequestOtpResponse {
  message: string;
  expiresInMinutes: number;
  otp?: string;
}
