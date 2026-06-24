import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MerchantAuthService } from '../services/merchant-auth.service';

export const merchantAuthGuard: CanActivateFn = () => {
  const auth = inject(MerchantAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/merchant/login']);
};

export const merchantGuestGuard: CanActivateFn = () => {
  const auth = inject(MerchantAuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/merchant/dashboard']);
};
