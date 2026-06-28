const env = require("../../../config/env");
const { escapeHtml } = require("./escape");

const BRAND = "#13294b";
const BRAND_LIGHT = "#243a56";
const ACCENT = "#4a6789";
const BG = "#f4f6f9";
const TEXT = "#1e293b";
const MUTED = "#64748b";

const getFrontendUrl = () => (env.frontendUrl || "https://support.elvatech.in").replace(/\/$/, "");
const getLogoUrl = () => `${getFrontendUrl()}/images/elva-logo.png`;
const getSupportEmail = () => env.email.supportAddress || "support@elvatech.in";

/**
 * Oracle-style responsive email shell: logo header, gradient hero, white body card, footer.
 */
const renderEmailLayout = ({
  heroTitle,
  heroSubtitle = "ELVA Support",
  preheader = "",
  bodyHtml,
  footerHtml
}) => {
  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
    : "";

  const defaultFooter = `
    <p style="margin:0 0 8px;font-size:13px;color:${MUTED};">
      Need help? Email <a href="mailto:${escapeHtml(getSupportEmail())}" style="color:${ACCENT};text-decoration:none;">${escapeHtml(getSupportEmail())}</a>
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} ELVA Tech · Elevating Value</p>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(heroTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(19,41,75,0.08);">
          <tr>
            <td style="padding:20px 28px;background-color:#ffffff;border-bottom:1px solid #e8ecf2;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${escapeHtml(getLogoUrl())}" alt="ELVA" width="48" height="48" style="display:inline-block;vertical-align:middle;border-radius:8px;" />
                    <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};">ELVA Support</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0;background:linear-gradient(135deg,${BRAND} 0%,${BRAND_LIGHT} 45%,#2d5a7b 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:36px 28px 32px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.75);">${escapeHtml(heroSubtitle)}</p>
                    <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;">${escapeHtml(heroTitle)}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 28px;font-size:15px;line-height:1.65;color:${TEXT};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;background-color:#f8fafc;border-top:1px solid #e8ecf2;text-align:center;">
              ${footerHtml || defaultFooter}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const renderParagraph = (text) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT};">${text}</p>`;

const renderCtaButton = (label, href) =>
  `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px;">
    <tr>
      <td style="border-radius:8px;background-color:${BRAND};">
        <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;

const renderCodeBlock = (code, label = "Your verification code") =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
    <tr>
      <td align="center" style="padding:24px;background-color:#f1f5f9;border-radius:10px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</p>
        <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.2em;color:${BRAND};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${escapeHtml(code)}</p>
      </td>
    </tr>
  </table>`;

const renderInfoBox = (html) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;">
    <tr>
      <td style="padding:16px 18px;background-color:#f8fafc;border-left:4px solid ${ACCENT};border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:${TEXT};">
        ${html}
      </td>
    </tr>
  </table>`;

const renderQuote = (text) =>
  `<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:14px;line-height:1.6;">${escapeHtml(text)}</blockquote>`;

module.exports = {
  renderEmailLayout,
  renderParagraph,
  renderCtaButton,
  renderCodeBlock,
  renderInfoBox,
  renderQuote,
  getFrontendUrl,
  getSupportEmail,
  BRAND,
  MUTED
};
