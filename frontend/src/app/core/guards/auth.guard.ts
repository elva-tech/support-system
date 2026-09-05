import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PortalContextService } from '../portal/portal-context.service';

/** @deprecated Prefer tenantAuthGuard — kept for any remaining imports */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const portal = inject(PortalContextService);
  const router = inject(Router);

  if (!portal.isTenantPortal) {
    return router.createUrlTree(['/']);
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const portal = inject(PortalContextService);
  const router = inject(Router);

  if (!portal.isTenantPortal) {
    return router.createUrlTree(['/']);
  }

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
