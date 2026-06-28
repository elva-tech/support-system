/** Merchant portal routes live under /api/merchant — not /api/merchants (admin CRUD). */
export const isMerchantPortalApi = (url: string): boolean =>
  /\/api\/merchant(\/|$|\?)/.test(url);
