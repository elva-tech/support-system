/**
 * Centralized ELVA platform default branding (Phase 12).
 * Components and email should read from here / BrandingService — not hardcode.
 */

/** Hex #RGB or #RRGGBB only — never arbitrary CSS. */
const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const ELVA_DEFAULT_BRANDING = Object.freeze({
  organizationName: "ELVA Technologies",
  supportDisplayName: "ELVA Support",
  productName: "ELVA Support",
  primaryColor: "#13294b",
  secondaryColor: "#4a6789",
  loginTitle: "Staff Sign In",
  loginSubtitle: "Sign in to this workspace with your admin, team lead, or agent credentials",
  faviconUrl: null,
  logoPath: "/images/elva-logo.png"
});

const isValidHexColor = (value) => {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  return HEX_COLOR_PATTERN.test(String(value).trim());
};

/** Expand #RGB → #RRGGBB; return null if invalid. */
const normalizeHexColor = (value) => {
  if (!isValidHexColor(value)) {
    return null;
  }
  const raw = String(value).trim();
  if (raw.length === 4) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
};

const hexToRgb = (hex) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
};

const rgbToHex = ({ r, g, b }) => {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
};

/** Darken hex toward black by amount 0–1. */
const darkenHex = (hex, amount = 0.12) => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  const factor = 1 - Math.max(0, Math.min(1, amount));
  return rgbToHex({ r: rgb.r * factor, g: rgb.g * factor, b: rgb.b * factor });
};

/** Mix hex toward white by amount 0–1 for light tints. */
const lightenHex = (hex, amount = 0.88) => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: rgb.r + (255 - rgb.r) * t,
    g: rgb.g + (255 - rgb.g) * t,
    b: rgb.b + (255 - rgb.b) * t
  });
};

/**
 * Safe theme tokens for CSS variables / email.
 * Invalid colors fall back to ELVA defaults.
 */
const resolveThemeColors = ({ primaryColor, secondaryColor } = {}) => {
  const primary =
    normalizeHexColor(primaryColor) || ELVA_DEFAULT_BRANDING.primaryColor;
  const secondary =
    normalizeHexColor(secondaryColor) || ELVA_DEFAULT_BRANDING.secondaryColor;
  return {
    primary,
    secondary,
    primaryHover: darkenHex(primary, 0.12) || primary,
    primaryLight: lightenHex(primary, 0.88) || "#e8eef5"
  };
};

module.exports = {
  HEX_COLOR_PATTERN,
  ELVA_DEFAULT_BRANDING,
  isValidHexColor,
  normalizeHexColor,
  darkenHex,
  lightenHex,
  resolveThemeColors
};
