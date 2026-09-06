import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { PortalContextService } from '../portal/portal-context.service';
import { PlatformAuthService, PlatformRole } from '../services/platform-auth.service';
import {
  CentralSupportAuthService,
  CentralSupportRole
} from '../services/central-support-auth.service';
import { AuthService } from '../services/auth.service';

export const platformPortalCanMatch: CanMatchFn = () => {
  const portal = inject(PortalContextService);
  return portal.isPlatformPortal;
};

export const centralSupportPortalCanMatch: CanMatchFn = () => {
  const portal = inject(PortalContextService);
  return portal.isCentralSupportPortal;
};

export const apexPortalCanMatch: CanMatchFn = () => {
  const portal = inject(PortalContextService);
  return portal.isApexPortal;
};

export const tenantPortalCanMatch: CanMatchFn = () => {
  const portal = inject(PortalContextService);
  return portal.isTenantPortal;
};

export const platformAuthGuard: CanActivateFn = () => {
  const portal = inject(PortalContextService);
  const auth = inject(PlatformAuthService);
  const router = inject(Router);

  if (!portal.isPlatformPortal) {
    return router.createUrlTree(['/']);
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const platformGuestGuard: CanActivateFn = () => {
  const portal = inject(PortalContextService);
  const auth = inject(PlatformAuthService);
  const router = inject(Router);

  if (!portal.isPlatformPortal) {
    return router.createUrlTree(['/']);
  }

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

export const centralSupportAuthGuard: CanActivateFn = () => {
  const portal = inject(PortalContextService);
  const auth = inject(CentralSupportAuthService);
  const router = inject(Router);

  if (!portal.isCentralSupportPortal) {
    return router.createUrlTree(['/']);
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const centralSupportGuestGuard: CanActivateFn = () => {
  const portal = inject(PortalContextService);
  const auth = inject(CentralSupportAuthService);
  const router = inject(Router);

  if (!portal.isCentralSupportPortal) {
    return router.createUrlTree(['/']);
  }

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

export const platformRoleGuard = (...roles: PlatformRole[]): CanActivateFn => {
  return () => {
    const auth = inject(PlatformAuthService);
    const router = inject(Router);

    if (auth.hasRole(...roles)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
};

export const centralSupportRoleGuard = (...roles: CentralSupportRole[]): CanActivateFn => {
  return () => {
    const auth = inject(CentralSupportAuthService);
    const router = inject(Router);

    if (auth.hasRole(...roles)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
};

/** Tenant workspace requires TENANT portal + staff auth */
export const tenantAuthGuard: CanActivateFn = () => {
  const portal = inject(PortalContextService);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!portal.isTenantPortal) {
    return router.createUrlTree(['/']);
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};

export const tenantGuestGuard: CanActivateFn = () => {
  const portal = inject(PortalContextService);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!portal.isTenantPortal) {
    return router.createUrlTree(['/']);
  }

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
