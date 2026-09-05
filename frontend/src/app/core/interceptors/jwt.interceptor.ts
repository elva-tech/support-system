import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { PlatformAuthService } from '../services/platform-auth.service';
import { PortalContextService } from '../portal/portal-context.service';
import { isMerchantPortalApi, isOnboardingApi, isPlatformApi } from '../utils/api-path.util';

/**
 * Attaches the correct auth / tenant context headers.
 * - Platform APIs → platform_access_token only (no X-Tenant-Slug)
 * - Merchant APIs → handled by merchant interceptor
 * - Onboarding APIs → no bearer token
 * - Tenant APIs → tenant_access_token (+ optional X-Tenant-Slug in dev)
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (isMerchantPortalApi(req.url) || isOnboardingApi(req.url)) {
    return next(req);
  }

  if (isPlatformApi(req.url)) {
    const platformAuth = inject(PlatformAuthService);
    const platformToken = platformAuth.token();
    if (platformToken) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${platformToken}` }
      });
    }
    return next(req);
  }

  const auth = inject(AuthService);
  const portal = inject(PortalContextService);
  const headers: Record<string, string> = {};

  const tenantToken = auth.token();
  if (tenantToken) {
    headers['Authorization'] = `Bearer ${tenantToken}`;
  }

  if (portal.shouldSendTenantSlugHeader && portal.tenantSlug) {
    headers['X-Tenant-Slug'] = portal.tenantSlug;
  }

  if (Object.keys(headers).length) {
    req = req.clone({ setHeaders: headers });
  }

  return next(req);
};
