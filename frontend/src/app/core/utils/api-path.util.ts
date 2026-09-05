/** Merchant portal routes live under /api/merchant — not /api/merchants (admin CRUD). */
export const isMerchantPortalApi = (url: string): boolean =>
  /\/api\/merchant(\/|$|\?)/.test(url);

/** Platform Administration APIs under /api/platform */
export const isPlatformApi = (url: string): boolean =>
  /\/api\/platform(\/|$|\?)/.test(url);

/** Public onboarding (invitation) — no auth token */
export const isOnboardingApi = (url: string): boolean =>
  /\/api\/onboarding(\/|$|\?)/.test(url);
