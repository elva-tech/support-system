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
import {
  ELVA_FAVICON_PATH,
  NEUTRAL_WORKSPACE_ICON,
  PortalBootstrapState,
  WorkspaceBranding
} from './branding.types';

export type { PortalBootstrapState, WorkspaceBranding } from './branding.types';
export { NEUTRAL_WORKSPACE_ICON, ELVA_FAVICON_PATH } from './branding.types';

const THEME_CSS_VARS = [
  '--tenant-primary-color',
  '--tenant-secondary-color',
  '--tenant-primary-hover',
  '--tenant-primary-light',
  '--tenant-primary-contrast'
] as const;

/**
 * Single source of truth for tenant presentation + portal bootstrap readiness.
 * Platform/apex use ELVA defaults immediately; tenant hosts never flash ELVA branding.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly portal = inject(PortalContextService);
  private readonly workspaceApi = inject(WorkspaceApiService);
  private readonly overrideSignal = signal<Partial<WorkspaceBranding> | null>(null);
  private logoObjectUrl: string | null = null;
  private loadedForSlug: string | null = null;
  private loadInFlight = false;

  readonly workspaceUnavailable = signal(false);
  readonly bootstrapState = signal<PortalBootstrapState>('idle');
  readonly bootstrapError = signal<string | null>(null);

  readonly branding = computed<WorkspaceBranding>(() => {
    const override = this.overrideSignal();
    const defaults = this.defaultBranding();
    return { ...defaults, ...override };
  });

  readonly isPortalReady = computed(() => {
    if (this.portal.isApexPortal || this.portal.isPlatformPortal) {
      return true;
    }
    if (this.portal.isUnknownPortal) {
      return true;
    }
    const state = this.bootstrapState();
    return state === 'ready' || state === 'not-found' || state === 'error';
  });

  /** Start hostname-aware bootstrap once at app root. */
  bootstrapPortal(): void {
    if (this.portal.isApexPortal || this.portal.isPlatformPortal) {
      this.workspaceUnavailable.set(false);
      this.bootstrapError.set(null);
      this.bootstrapState.set('ready');
      this.applyPlatformDefaults();
      return;
    }

    if (this.portal.isUnknownPortal) {
      this.workspaceUnavailable.set(false);
      this.bootstrapError.set(null);
      this.bootstrapState.set('ready');
      this.resetCssVariables();
      return;
    }

    if (!this.portal.isTenantPortal || !this.portal.tenantSlug) {
      this.bootstrapState.set('ready');
      return;
    }

    this.loadTenantBranding({ force: false });
  }

  /** Call when entering a tenant portal (shell / login). Non-blocking after bootstrap. */
  loadTenantBranding(options: { force?: boolean } = {}): void {
    if (this.portal.isPlatformPortal || this.portal.isApexPortal) {
      this.workspaceUnavailable.set(false);
      this.bootstrapState.set('ready');
      this.applyPlatformDefaults();
      return;
    }

    if (!this.portal.isTenantPortal || !this.portal.tenantSlug) {
      this.applyCssVariables(null, null);
      this.bootstrapState.set('ready');
      return;
    }

    const slug = this.portal.tenantSlug;
    if (!options.force && (this.loadedForSlug === slug || this.loadInFlight)) {
      return;
    }

    this.loadedForSlug = slug;
    this.loadInFlight = true;
    this.workspaceUnavailable.set(false);
    this.bootstrapError.set(null);
    this.bootstrapState.set('loading');
    // Neutral defaults only — never ELVA logo/colors on tenant hosts while loading
    this.overrideSignal.set(null);
    this.resetCssVariables();

    this.workspaceApi.getPublicBranding().subscribe({
      next: (res) => {
        this.loadInFlight = false;
        this.workspaceUnavailable.set(false);
        const data = res.data;
        const primary = normalizeHexColor(data.primaryColor);
        const secondary = normalizeHexColor(data.secondaryColor);
        const hasLogo = Boolean(data.logoAvailable ?? data.hasLogo);

        this.applyTenantBranding({
          productName: data.supportDisplayName || data.organizationName || 'Support Workspace',
          displayName: data.organizationName || data.displayName || data.tenantName,
          organizationName: data.organizationName || data.displayName || data.tenantName,
          supportDisplayName: data.supportDisplayName || data.organizationName || 'Support',
          primaryColor: primary,
          secondaryColor: secondary,
          loginTitle: data.loginTitle || '',
          loginSubtitle: data.loginSubtitle || '',
          customerLabel: normalizeCustomerLabel(data.customerLabel),
          logoAvailable: hasLogo,
          logoUrl: hasLogo ? null : NEUTRAL_WORKSPACE_ICON,
          faviconUrl: hasLogo ? null : NEUTRAL_WORKSPACE_ICON
        });

        this.applyCssVariables(primary, secondary);

        if (hasLogo) {
          this.workspaceApi.fetchLogoBlob().subscribe({
            next: (blob) => {
              if (this.logoObjectUrl) {
                URL.revokeObjectURL(this.logoObjectUrl);
              }
              this.logoObjectUrl = URL.createObjectURL(blob);
              this.applyTenantBranding({
                ...this.overrideSignal(),
                logoUrl: this.logoObjectUrl,
                faviconUrl: this.logoObjectUrl,
                logoAvailable: true
              });
              this.bootstrapState.set('ready');
            },
            error: () => {
              this.applyTenantBranding({
                ...this.overrideSignal(),
                logoUrl: NEUTRAL_WORKSPACE_ICON,
                faviconUrl: NEUTRAL_WORKSPACE_ICON,
                logoAvailable: false
              });
              this.bootstrapState.set('ready');
            }
          });
        } else {
          this.bootstrapState.set('ready');
        }
      },
      error: (err) => {
        this.loadInFlight = false;
        this.loadedForSlug = null;
        const status = err?.status;
        const code = err?.error?.errors?.code || err?.error?.code;
        if (status === 404 || code === 'TENANT_NOT_FOUND') {
          this.workspaceUnavailable.set(true);
          this.overrideSignal.set(null);
          this.resetCssVariables();
          this.bootstrapState.set('not-found');
          this.bootstrapError.set('This workspace may no longer exist or the address may be incorrect.');
          return;
        }
        this.workspaceUnavailable.set(false);
        this.bootstrapState.set('error');
        this.bootstrapError.set(err?.error?.message || 'Failed to load workspace branding');
        this.resetCssVariables();
      }
    });
  }

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
      productName: branding.supportDisplayName || 'Support Workspace',
      displayName: branding.organizationName || 'Support Workspace',
      organizationName: branding.organizationName || 'Support Workspace',
      supportDisplayName: branding.supportDisplayName || 'Support',
      primaryColor: primary,
      secondaryColor: secondary,
      loginTitle: branding.loginTitle || '',
      loginSubtitle: branding.loginSubtitle || '',
      customerLabel: normalizeCustomerLabel(branding.customerLabel),
      logoAvailable: Boolean(branding.logoAvailable),
      logoUrl: branding.logoAvailable ? null : NEUTRAL_WORKSPACE_ICON,
      faviconUrl: branding.logoAvailable ? null : NEUTRAL_WORKSPACE_ICON
    });
    this.applyCssVariables(primary, secondary);
    this.bootstrapState.set('ready');
  }

  refreshTenantBranding(): void {
    this.loadedForSlug = null;
    this.loadTenantBranding({ force: true });
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
    if (!primaryColor && this.portal.isTenantPortal) {
      this.resetCssVariables();
      return;
    }

    const colors = resolveThemeColors(primaryColor, secondaryColor);
    root.style.setProperty('--tenant-primary-color', colors.primary);
    root.style.setProperty('--tenant-secondary-color', colors.secondary);
    root.style.setProperty('--tenant-primary-hover', colors.primaryHover);
    root.style.setProperty('--tenant-primary-light', colors.primaryLight);
    root.style.setProperty('--tenant-primary-contrast', colors.primaryContrast);
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
    if (this.portal.isPlatformPortal || this.portal.isApexPortal) {
      return {
        productName: this.portal.isPlatformPortal
          ? 'ELVA Support Platform'
          : ELVA_DEFAULT_BRANDING.productName,
        displayName: this.portal.isPlatformPortal
          ? 'Platform Administration'
          : ELVA_DEFAULT_BRANDING.organizationName,
        organizationName: ELVA_DEFAULT_BRANDING.organizationName,
        primaryColor: ELVA_DEFAULT_BRANDING.primaryColor,
        secondaryColor: ELVA_DEFAULT_BRANDING.secondaryColor,
        logoUrl: ELVA_DEFAULT_BRANDING.logoPath,
        supportDisplayName: ELVA_DEFAULT_BRANDING.supportDisplayName,
        loginTitle: this.portal.isPlatformPortal ? 'Platform Sign In' : 'ELVA Support',
        loginSubtitle: this.portal.isPlatformPortal
          ? 'Sign in with your platform administrator credentials'
          : 'Customer support platform',
        customerLabel: DEFAULT_CUSTOMER_LABEL,
        logoAvailable: true,
        faviconUrl: ELVA_FAVICON_PATH
      };
    }

    const slug = this.portal.tenantSlug;
    return {
      productName: 'Support Workspace',
      displayName: slug ? `${slug} workspace` : 'Support Workspace',
      organizationName: slug ? `${slug} workspace` : 'Support Workspace',
      primaryColor: null,
      secondaryColor: null,
      logoUrl: NEUTRAL_WORKSPACE_ICON,
      supportDisplayName: 'Support',
      loginTitle: 'Customer Help Center',
      loginSubtitle: 'Secure support portal for this workspace',
      customerLabel: DEFAULT_CUSTOMER_LABEL,
      logoAvailable: false,
      faviconUrl: NEUTRAL_WORKSPACE_ICON
    };
  }
}
