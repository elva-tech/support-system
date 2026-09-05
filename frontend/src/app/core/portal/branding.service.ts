import { Injectable, computed, inject, signal } from '@angular/core';
import { PortalContextService } from './portal-context.service';

export interface WorkspaceBranding {
  productName: string;
  displayName: string;
  primaryColor: string | null;
  logoUrl: string | null;
  supportDisplayName: string;
}

/**
 * Lightweight branding foundation — defaults today; tenant.settings.branding later.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly portal = inject(PortalContextService);
  private readonly overrideSignal = signal<Partial<WorkspaceBranding> | null>(null);

  readonly branding = computed<WorkspaceBranding>(() => {
    const override = this.overrideSignal();
    const defaults = this.defaultBranding();
    return { ...defaults, ...override };
  });

  applyTenantBranding(partial: Partial<WorkspaceBranding> | null): void {
    this.overrideSignal.set(partial);
  }

  clearOverride(): void {
    this.overrideSignal.set(null);
  }

  private defaultBranding(): WorkspaceBranding {
    if (this.portal.isPlatformPortal) {
      return {
        productName: 'ELVA Support Platform',
        displayName: 'Platform Administration',
        primaryColor: null,
        logoUrl: '/images/elva-logo.png',
        supportDisplayName: 'ELVA Support'
      };
    }

    const slug = this.portal.tenantSlug;
    return {
      productName: 'Support Workspace',
      displayName: slug ? `${slug} workspace` : 'Support Workspace',
      primaryColor: null,
      logoUrl: '/images/elva-logo.png',
      supportDisplayName: 'Support'
    };
  }
}
