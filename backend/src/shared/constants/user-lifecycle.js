/**
 * Tenant staff user lifecycle (Phase 10).
 * Kept separate from invitation status and tenant status enums.
 */

const USER_STATUSES = Object.freeze({
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DEACTIVATED: "DEACTIVATED"
});

const ALL_USER_STATUSES = Object.values(USER_STATUSES);

const LOGIN_ALLOWED_STATUSES = Object.freeze([USER_STATUSES.ACTIVE]);

/**
 * Server-side login/API access gate.
 * Prefer status when present; fall back to isActive for pre-migration documents.
 */
const isUserLoginAllowed = (user) => {
  if (!user) {
    return false;
  }
  if (user.status) {
    return LOGIN_ALLOWED_STATUSES.includes(user.status) && user.isActive !== false;
  }
  return user.isActive === true;
};

const isActiveFlagForStatus = (status) => status === USER_STATUSES.ACTIVE;

module.exports = {
  USER_STATUSES,
  ALL_USER_STATUSES,
  LOGIN_ALLOWED_STATUSES,
  isUserLoginAllowed,
  isActiveFlagForStatus
};
