const crypto = require("crypto");
const env = require("../../config/env");

const hashInvitationToken = (rawToken) =>
  crypto.createHash("sha256").update(String(rawToken), "utf8").digest("hex");

/**
 * Generate a high-entropy invitation token.
 * Returns { rawToken, tokenHash } — store only tokenHash; send only rawToken in email URL.
 */
const generateInvitationToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashInvitationToken(rawToken)
  };
};

/**
 * Unusable random password for invited users until they complete setup.
 * Satisfies User.password required + minlength without allowing login (isActive: false).
 */
const generateUnusablePassword = () => crypto.randomBytes(48).toString("base64url");

const getInvitationExpiryDate = (fromDate = new Date()) => {
  const hours = env.tenantProvisioning.invitationExpiryHours;
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
};

const buildWorkspaceUrl = (slug) => {
  const protocol = env.tenantProvisioning.workspaceProtocol;
  const domain = env.tenant.baseDomain;
  return `${protocol}://${String(slug).toLowerCase()}.${domain}`;
};

const buildInvitationUrl = (slug, rawToken) => {
  const workspaceUrl = buildWorkspaceUrl(slug);
  const path = env.tenantProvisioning.onboardingPath.startsWith("/")
    ? env.tenantProvisioning.onboardingPath
    : `/${env.tenantProvisioning.onboardingPath}`;
  return `${workspaceUrl}${path}?token=${encodeURIComponent(rawToken)}`;
};

/**
 * Split "John Doe" → { firstName, lastName }. Single token uses lastName "-".
 */
const splitAdminName = (fullName) => {
  const trimmed = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { firstName: "Admin", lastName: "User" };
  }
  const parts = trimmed.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "-" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ")
  };
};

const assertValidPassword = (password) => {
  const ApiError = require("../../shared/utils/ApiError");
  const { PROVISIONING_ERROR_CODES } = require("../../shared/constants/provisioning");
  if (!password || String(password).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters", {
      code: PROVISIONING_ERROR_CODES.INVALID_PASSWORD
    });
  }
  if (String(password).length > 128) {
    throw new ApiError(400, "Password must be at most 128 characters", {
      code: PROVISIONING_ERROR_CODES.INVALID_PASSWORD
    });
  }
  return String(password);
};

module.exports = {
  hashInvitationToken,
  generateInvitationToken,
  generateUnusablePassword,
  getInvitationExpiryDate,
  buildWorkspaceUrl,
  buildInvitationUrl,
  splitAdminName,
  assertValidPassword
};
