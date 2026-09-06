/**
 * Centralized ELVA platform default branding (Phase 12).
 * Mirror of backend default-branding — keep values aligned.
 */

export const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export const ELVA_DEFAULT_BRANDING = Object.freeze({
  organizationName: 'ELVA Technologies',
  supportDisplayName: 'ELVA Support',
  productName: 'ELVA Support',
  primaryColor: '#13294b',
  secondaryColor: '#4a6789',
  loginTitle: 'Staff Sign In',
  loginSubtitle: 'Sign in to this workspace with your admin, team lead, or agent credentials',
  faviconUrl: null as string | null,
  logoPath: '/images/elva-logo.png'
});

export type CustomerLabel = 'CLIENT' | 'CUSTOMER' | 'MERCHANT';

export const DEFAULT_CUSTOMER_LABEL: CustomerLabel = 'CLIENT';

export const CUSTOMER_LABEL_COPY: Record<
  CustomerLabel,
  { singular: string; plural: string; add: string; details: string; empty: string }
> = {
  CLIENT: {
    singular: 'Client',
    plural: 'Clients',
    add: 'Add Client',
    details: 'Client Details',
    empty: 'No clients registered yet.'
  },
  CUSTOMER: {
    singular: 'Customer',
    plural: 'Customers',
    add: 'Add Customer',
    details: 'Customer Details',
    empty: 'No customers registered yet.'
  },
  MERCHANT: {
    singular: 'Merchant',
    plural: 'Merchants',
    add: 'Add Merchant',
    details: 'Merchant Details',
    empty: 'No merchants registered yet.'
  }
};

export function isValidHexColor(value: string | null | undefined): boolean {
  if (!value) return false;
  return HEX_COLOR_PATTERN.test(String(value).trim());
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!isValidHexColor(value)) return null;
  const raw = String(value).trim();
  if (raw.length === 4) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

export function darkenHex(hex: string, amount = 0.12): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const factor = 1 - Math.max(0, Math.min(1, amount));
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

export function lightenHex(hex: string, amount = 0.88): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    rgb.r + (255 - rgb.r) * t,
    rgb.g + (255 - rgb.g) * t,
    rgb.b + (255 - rgb.b) * t
  );
}

export function resolveThemeColors(primaryColor?: string | null, secondaryColor?: string | null) {
  const primary = normalizeHexColor(primaryColor) || ELVA_DEFAULT_BRANDING.primaryColor;
  const secondary = normalizeHexColor(secondaryColor) || ELVA_DEFAULT_BRANDING.secondaryColor;
  return {
    primary,
    secondary,
    primaryHover: darkenHex(primary, 0.12) || primary,
    primaryLight: lightenHex(primary, 0.88) || '#e8eef5',
    primaryContrast: contrastTextForBackground(primary)
  };
}

/** WCAG-ish relative luminance → black or white text on primary backgrounds */
export function contrastTextForBackground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#0f172a' : '#ffffff';
}

export function normalizeCustomerLabel(value: string | null | undefined): CustomerLabel {
  const raw = String(value || '')
    .trim()
    .toUpperCase();
  if (raw === 'CLIENT' || raw === 'CUSTOMER' || raw === 'MERCHANT') {
    return raw;
  }
  return DEFAULT_CUSTOMER_LABEL;
}
