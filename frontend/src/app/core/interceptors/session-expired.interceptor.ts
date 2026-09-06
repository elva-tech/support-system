import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CentralSupportAuthService } from '../services/central-support-auth.service';
import { PlatformAuthService } from '../services/platform-auth.service';
import {
  isCentralSupportApi,
  isMerchantPortalApi,
  isOnboardingApi,
  isPlatformApi
} from '../utils/api-path.util';
import { MerchantAuthService } from '../../merchant-portal/services/merchant-auth.service';

const AUTH_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/platform/auth/login',
  '/api/central-support/auth/login',
  '/api/merchant/request-otp',
  '/api/merchant/verify-otp',
  '/api/onboarding/'
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

const redirectPlatformToLogin = (router: Router, platformAuth: PlatformAuthService): void => {
  if (redirectInProgress) return;

  const email = platformAuth.currentAdmin()?.email;
  redirectInProgress = true;
  platformAuth.logout();

  router
    .navigate(['/login'], {
      queryParams: {
        ...(email ? { email } : {}),
        session: 'expired'
      }
    })
    .finally(() => {
      redirectInProgress = false;
    });
};

const redirectCentralSupportToLogin = (
  router: Router,
  csAuth: CentralSupportAuthService
): void => {
  if (redirectInProgress) return;

  const email = csAuth.currentUser()?.email;
  redirectInProgress = true;
  csAuth.logout();

  router
    .navigate(['/login'], {
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
  const platformAuth = inject(PlatformAuthService);
  const centralSupportAuth = inject(CentralSupportAuthService);
  const merchantAuth = inject(MerchantAuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (isExempt(req.url) || isOnboardingApi(req.url)) {
        return throwError(() => error);
      }

      if (isCentralSupportApi(req.url)) {
        const onCsLogin = router.url.startsWith('/login');
        if (onCsLogin || !centralSupportAuth.isAuthenticated()) {
          return throwError(() => error);
        }
        redirectCentralSupportToLogin(router, centralSupportAuth);
        return EMPTY;
      }

      if (isPlatformApi(req.url)) {
        const onPlatformLogin = router.url.startsWith('/login');
        if (onPlatformLogin || !platformAuth.isAuthenticated()) {
          return throwError(() => error);
        }
        redirectPlatformToLogin(router, platformAuth);
        return EMPTY;
      }

      const onStaffLogin = router.url.startsWith('/auth/login') || router.url === '/login';
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
