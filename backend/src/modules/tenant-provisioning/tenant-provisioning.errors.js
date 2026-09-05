const ApiError = require("../../shared/utils/ApiError");
const { PROVISIONING_ERROR_CODES } = require("../../shared/constants/provisioning");

const provisioningError = (statusCode, code, message) =>
  new ApiError(statusCode, message, { code });

const provisioningNotFound = () =>
  provisioningError(404, PROVISIONING_ERROR_CODES.PROVISIONING_NOT_FOUND, "Provisioning not found");

const provisioningConflict = (detail = "Provisioning conflict") =>
  provisioningError(409, PROVISIONING_ERROR_CODES.PROVISIONING_CONFLICT, detail);

const provisioningNotRetriable = (detail = "Provisioning cannot be retried") =>
  provisioningError(400, PROVISIONING_ERROR_CODES.PROVISIONING_NOT_RETRIABLE, detail);

const invalidInvitation = () =>
  provisioningError(400, PROVISIONING_ERROR_CODES.INVALID_INVITATION, "Invalid or expired invitation");

const invitationExpired = () =>
  provisioningError(400, PROVISIONING_ERROR_CODES.INVITATION_EXPIRED, "Invitation has expired");

const invitationAlreadyUsed = () =>
  provisioningError(
    400,
    PROVISIONING_ERROR_CODES.INVITATION_ALREADY_USED,
    "Invitation has already been used"
  );

const tenantAdminEmailExists = () =>
  provisioningError(
    409,
    PROVISIONING_ERROR_CODES.TENANT_ADMIN_EMAIL_EXISTS,
    "A user with this email already exists in the tenant"
  );

module.exports = {
  provisioningError,
  provisioningNotFound,
  provisioningConflict,
  provisioningNotRetriable,
  invalidInvitation,
  invitationExpired,
  invitationAlreadyUsed,
  tenantAdminEmailExists
};
