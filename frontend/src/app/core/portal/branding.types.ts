import {
  CustomerLabel,
  DEFAULT_CUSTOMER_LABEL,
  ELVA_DEFAULT_BRANDING,
  normalizeCustomerLabel,
  normalizeHexColor,
  resolveThemeColors
} from './default-branding';

export type PortalBootstrapState = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';

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
  /** Absolute or blob URL for favicon; null = leave default / unset for tenant */
  faviconUrl: string | null;
}

export const NEUTRAL_WORKSPACE_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#e2e8f0"/><circle cx="32" cy="26" r="12" fill="#94a3b8"/><path d="M12 54c4-12 16-18 20-18s16 6 20 18" fill="#94a3b8"/></svg>`
  );

export const ELVA_FAVICON_PATH = '/images/elva-logo.png';
