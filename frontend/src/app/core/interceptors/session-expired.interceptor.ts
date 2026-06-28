import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { isMerchantPortalApi } from '../utils/api-path.util';
import { MerchantAuthService } from '../../merchant-portal/services/merchant-auth.service';

const AUTH_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/merchant/request-otp',
  '/api/merchant/verify-otp'
];

let redirectInProgress = false;

const isExempt = (url: string): boolean =>
  AUTH_EXEMPT_PATHS.some((path) => url.includes(path));

const redirectStaffToLogin = (router: Router, auth: AuthService): void => {
  if (redirectInProgress) return;

  const email = auth.currentUser()?.email;
  redirectInProgress = true;
  auth.logout();

  router
    .navigate(['/auth/login'], {
      queryParams: {
        ...(email ? { email } : {}),
        session: 'expired'
      }
    })
    .finally(() => {
      redirectInProgress = false;
    });
};

const redirectMerchantToLogin = (router: Router, merchantAuth: MerchantAuthService): void => {
  if (redirectInProgress) return;

  const email = merchantAuth.currentMerchant()?.email;
  redirectInProgress = true;
  merchantAuth.logout();

  router
    .navigate(['/merchant/login'], {
      queryParams: {
        ...(email ? { email } : {}),
        session: 'expired'
      }
    })
    .finally(() => {
      redirectInProgress = false;
    });
};

export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const merchantAuth = inject(MerchantAuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (isExempt(req.url)) {
        return throwError(() => error);
      }

      const onStaffLogin = router.url.startsWith('/auth/login');
      const onMerchantLogin =
        router.url.startsWith('/merchant/login') || router.url.startsWith('/merchant/verify-otp');

      const isMerchantApi = isMerchantPortalApi(req.url);
      const isMerchantAttachment =
        req.url.includes('/api/attachments') && !!merchantAuth.sessionToken() && !auth.token();

      if (isMerchantApi || isMerchantAttachment) {
        if (onMerchantLogin || !merchantAuth.isAuthenticated()) {
          return throwError(() => error);
        }

        redirectMerchantToLogin(router, merchantAuth);
        return EMPTY;
      }

      if (onStaffLogin || !auth.isAuthenticated()) {
        return throwError(() => error);
      }

      redirectStaffToLogin(router, auth);
      return EMPTY;
    })
  );
};
