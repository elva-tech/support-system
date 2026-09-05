import { Injectable, computed, inject, signal } from '@angular/core';
import { PortalContextService } from './portal-context.service';
import { WorkspaceApiService } from '../services/workspace-api.service';
import { environment } from '../../../environments/environment';

export interface WorkspaceBranding {
  productName: string;
  displayName: string;
  primaryColor: string | null;
  logoUrl: string | null;
  supportDisplayName: string;
}

/**
 * Tenant-aware branding. Loads public branding for the current workspace host.
 * Logo is fetched as a blob so X-Tenant-Slug / auth headers apply.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly portal = inject(PortalContextService);
  private readonly workspaceApi = inject(WorkspaceApiService);
  private readonly overrideSignal = signal<Partial<WorkspaceBranding> | null>(null);
  private logoObjectUrl: string | null = null;
  private loadedForSlug: string | null = null;

  readonly branding = computed<WorkspaceBranding>(() => {
    const override = this.overrideSignal();
    const defaults = this.defaultBranding();
    return { ...defaults, ...override };
  });

  /** Call once when entering a tenant portal (APP init or shell). */
  loadTenantBranding(): void {
    if (!this.portal.isTenantPortal || !this.portal.tenantSlug) {
      return;
    }

    const slug = this.portal.tenantSlug;
    if (this.loadedForSlug === slug) {
      return;
    }
    this.loadedForSlug = slug;

    this.workspaceApi.getPublicBranding().subscribe({
      next: (res) => {
        const data = res.data;
        this.applyTenantBranding({
          productName: data.supportDisplayName || 'Support Workspace',
          displayName: data.displayName || data.tenantName,
          supportDisplayName: data.supportDisplayName,
          primaryColor: data.primaryColor,
          logoUrl: this.defaultBranding().logoUrl
        });

        if (data.hasLogo) {
          this.workspaceApi.fetchLogoBlob().subscribe({
            next: (blob) => {
              if (this.logoObjectUrl) {
                URL.revokeObjectURL(this.logoObjectUrl);
              }
              this.logoObjectUrl = URL.createObjectURL(blob);
              this.applyTenantBranding({
                ...this.overrideSignal(),
                logoUrl: this.logoObjectUrl
              });
            },
            error: () => {
              /* keep default logo */
            }
          });
        }
      },
      error: () => {
        this.loadedForSlug = null;
      }
    });
  }

  /** Refresh after admin saves branding (clears cache). */
  refreshTenantBranding(): void {
    this.loadedForSlug = null;
    this.loadTenantBranding();
  }

  applyTenantBranding(partial: Partial<WorkspaceBranding> | null): void {
    this.overrideSignal.set(partial);
  }

  clearOverride(): void {
    if (this.logoObjectUrl) {
      URL.revokeObjectURL(this.logoObjectUrl);
      this.logoObjectUrl = null;
    }
    this.overrideSignal.set(null);
    this.loadedForSlug = null;
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
      supportDisplayName: slug === environment.developmentTenantSlug ? 'ELVA Support' : 'Support'
    };
  }
}
