import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { isMerchantPortalApi } from '../utils/api-path.util';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (isMerchantPortalApi(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.token();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req);
};
