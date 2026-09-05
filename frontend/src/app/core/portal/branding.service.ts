import { Injectable, computed, inject, signal } from '@angular/core';
import { PortalContextService } from './portal-context.service';
import { WorkspaceApiService } from '../services/workspace-api.service';
import {
  CustomerLabel,
  DEFAULT_CUSTOMER_LABEL,
  ELVA_DEFAULT_BRANDING,
  normalizeCustomerLabel,
  normalizeHexColor,
  resolveThemeColors
} from './default-branding';

export interface WorkspaceBranding {
  productName: string;
  displayName: string;
  organizationName: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
  supportDisplayName: string;
  loginTitle: string;
  loginSubtitle: string;
  customerLabel: CustomerLabel;
  logoAvailable: boolean;
}

const THEME_CSS_VARS = [
  '--tenant-primary-color',
  '--tenant-secondary-color',
  '--tenant-primary-hover',
  '--tenant-primary-light'
] as const;

/**
 * Single source of truth for tenant presentation configuration (Phase 12).
 * Platform portal always uses ELVA defaults; tenant portal loads public branding.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly portal = inject(PortalContextService);
  private readonly workspaceApi = inject(WorkspaceApiService);
  private readonly overrideSignal = signal<Partial<WorkspaceBranding> | null>(null);
  private logoObjectUrl: string | null = null;
  private loadedForSlug: string | null = null;
  private loadInFlight = false;
  /** True when hostname maps to a tenant slug that does not exist (no ELVA fallback). */
  readonly workspaceUnavailable = signal(false);

  readonly branding = computed<WorkspaceBranding>(() => {
    const override = this.overrideSignal();
    const defaults = this.defaultBranding();
    return { ...defaults, ...override };
  });

  /** Call once when entering a tenant portal (shell / login). Non-blocking. */
  loadTenantBranding(): void {
    if (this.portal.isPlatformPortal) {
      this.workspaceUnavailable.set(false);
      this.applyPlatformDefaults();
      return;
    }

    if (!this.portal.isTenantPortal || !this.portal.tenantSlug) {
      this.applyCssVariables(null, null);
      return;
    }

    const slug = this.portal.tenantSlug;
    if (this.loadedForSlug === slug || this.loadInFlight) {
      return;
    }
    this.loadedForSlug = slug;
    this.loadInFlight = true;
    this.workspaceUnavailable.set(false);

    this.workspaceApi.getPublicBranding().subscribe({
      next: (res) => {
        this.loadInFlight = false;
        this.workspaceUnavailable.set(false);
        const data = res.data;
        const primary = normalizeHexColor(data.primaryColor);
        const secondary = normalizeHexColor(data.secondaryColor);

        this.applyTenantBranding({
          productName: data.supportDisplayName || 'Support Workspace',
          displayName: data.organizationName || data.displayName || data.tenantName,
          organizationName: data.organizationName || data.displayName || data.tenantName,
          supportDisplayName: data.supportDisplayName,
          primaryColor: primary,
          secondaryColor: secondary,
          loginTitle: data.loginTitle || '',
          loginSubtitle: data.loginSubtitle || '',
          customerLabel: normalizeCustomerLabel(data.customerLabel),
          logoAvailable: Boolean(data.logoAvailable ?? data.hasLogo),
          logoUrl: this.defaultBranding().logoUrl
        });

        this.applyCssVariables(primary, secondary);

        if (data.logoAvailable || data.hasLogo) {
          this.workspaceApi.fetchLogoBlob().subscribe({
            next: (blob) => {
              if (this.logoObjectUrl) {
                URL.revokeObjectURL(this.logoObjectUrl);
              }
              this.logoObjectUrl = URL.createObjectURL(blob);
              this.applyTenantBranding({
                ...this.overrideSignal(),
                logoUrl: this.logoObjectUrl,
                logoAvailable: true
              });
            },
            error: () => {
              /* keep default logo — auth must still work */
            }
          });
        }
      },
      error: (err) => {
        this.loadInFlight = false;
        this.loadedForSlug = null;
        const status = err?.status;
        const code = err?.error?.errors?.code || err?.error?.code;
        // Unknown tenant host: do not fall back to ELVA branding as if workspace exists
        if (status === 404 || code === 'TENANT_NOT_FOUND') {
          this.workspaceUnavailable.set(true);
          this.overrideSignal.set(null);
          this.applyCssVariables(null, null);
          return;
        }
        // Transient API failure: keep neutral defaults so login remains possible
        this.workspaceUnavailable.set(false);
        this.applyCssVariables(null, null);
      }
    });
  }

  /**
   * Apply branding from a validated invitation response (server-resolved).
   * Never trust query-param branding.
   */
  applyInvitationBranding(
    branding: {
      organizationName?: string;
      supportDisplayName?: string;
      primaryColor?: string | null;
      secondaryColor?: string | null;
      loginTitle?: string;
      loginSubtitle?: string;
      customerLabel?: string;
      logoAvailable?: boolean;
    } | null | undefined
  ): void {
    if (!branding) {
      this.applyCssVariables(null, null);
      return;
    }

    const primary = normalizeHexColor(branding.primaryColor);
    const secondary = normalizeHexColor(branding.secondaryColor);

    this.applyTenantBranding({
      productName: branding.supportDisplayName || ELVA_DEFAULT_BRANDING.productName,
      displayName: branding.organizationName || ELVA_DEFAULT_BRANDING.organizationName,
      organizationName: branding.organizationName || ELVA_DEFAULT_BRANDING.organizationName,
      supportDisplayName: branding.supportDisplayName || ELVA_DEFAULT_BRANDING.supportDisplayName,
      primaryColor: primary,
      secondaryColor: secondary,
      loginTitle: branding.loginTitle || '',
      loginSubtitle: branding.loginSubtitle || '',
      customerLabel: normalizeCustomerLabel(branding.customerLabel),
      logoAvailable: Boolean(branding.logoAvailable)
    });
    this.applyCssVariables(primary, secondary);
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
    this.applyPlatformDefaults();
  }

  applyPlatformDefaults(): void {
    this.overrideSignal.set(null);
    this.applyCssVariables(
      ELVA_DEFAULT_BRANDING.primaryColor,
      ELVA_DEFAULT_BRANDING.secondaryColor
    );
  }

  applyCssVariables(primaryColor: string | null, secondaryColor: string | null): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const colors = resolveThemeColors(primaryColor, secondaryColor);
    root.style.setProperty('--tenant-primary-color', colors.primary);
    root.style.setProperty('--tenant-secondary-color', colors.secondary);
    root.style.setProperty('--tenant-primary-hover', colors.primaryHover);
    root.style.setProperty('--tenant-primary-light', colors.primaryLight);
  }

  resetCssVariables(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    for (const key of THEME_CSS_VARS) {
      root.style.removeProperty(key);
    }
  }

  private defaultBranding(): WorkspaceBranding {
    if (this.portal.isPlatformPortal) {
      return {
        productName: 'ELVA Support Platform',
        displayName: 'Platform Administration',
        organizationName: ELVA_DEFAULT_BRANDING.organizationName,
        primaryColor: ELVA_DEFAULT_BRANDING.primaryColor,
        secondaryColor: ELVA_DEFAULT_BRANDING.secondaryColor,
        logoUrl: ELVA_DEFAULT_BRANDING.logoPath,
        supportDisplayName: ELVA_DEFAULT_BRANDING.supportDisplayName,
        loginTitle: 'Platform Sign In',
        loginSubtitle: 'Sign in with your platform administrator credentials',
        customerLabel: DEFAULT_CUSTOMER_LABEL,
        logoAvailable: false
      };
    }

    const slug = this.portal.tenantSlug;
    return {
      productName: 'Support Workspace',
      displayName: slug ? `${slug} workspace` : 'Support Workspace',
      organizationName: slug ? `${slug} workspace` : 'Support Workspace',
      primaryColor: null,
      secondaryColor: null,
      logoUrl: ELVA_DEFAULT_BRANDING.logoPath,
      supportDisplayName:
        slug === 'elva' ? ELVA_DEFAULT_BRANDING.supportDisplayName : 'Support',
      loginTitle: ELVA_DEFAULT_BRANDING.loginTitle,
      loginSubtitle: ELVA_DEFAULT_BRANDING.loginSubtitle,
      customerLabel: DEFAULT_CUSTOMER_LABEL,
      logoAvailable: false
    };
  }
}
