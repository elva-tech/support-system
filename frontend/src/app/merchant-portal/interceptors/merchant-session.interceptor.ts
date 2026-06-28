import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { isMerchantPortalApi } from '../../core/utils/api-path.util';
import { MerchantAuthService } from '../services/merchant-auth.service';

export const merchantSessionInterceptor: HttpInterceptorFn = (req, next) => {
  const needsMerchantSession = isMerchantPortalApi(req.url) || req.url.includes('/api/attachments');

  if (!needsMerchantSession) {
    return next(req);
  }

  const merchantAuth = inject(MerchantAuthService);
  const token = merchantAuth.sessionToken();

  if (token) {
    req = req.clone({
      setHeaders: { 'X-Merchant-Session': token }
    });
  }

  return next(req);
};
