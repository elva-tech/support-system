const env = require("../config/env");
const logger = require("../shared/utils/logger");
const User = require("../modules/users/user.model");
const { ROLES } = require("../shared/constants/roles");
const tenantService = require("../modules/tenants/tenant.service");

/**
 * Ensures the admin account from env exists on every server start.
 * Never deletes or re-seeds applications, teams, or other data.
 * Assigns ELVA tenantId when missing (Phase 4 membership).
 */
const ensureAdminAccount = async () => {
  const { email, password, firstName, lastName } = env.admin;
  const normalizedEmail = email.toLowerCase();

  const { tenant } = await tenantService.ensureElvaTenant();
  const tenantId = tenant._id;

  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    await User.create({
      tenantId,
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      role: ROLES.ADMIN,
      isActive: true
    });
    logger.info("Admin account created from env", { email: normalizedEmail });
    return;
  }

  let changed = false;

  if (!user.tenantId) {
    user.tenantId = tenantId;
    changed = true;
  }

  if (user.role !== ROLES.ADMIN) {
    user.role = ROLES.ADMIN;
    changed = true;
  }

  if (!user.isActive) {
    user.isActive = true;
    changed = true;
  }

  if (user.firstName !== firstName || user.lastName !== lastName) {
    user.firstName = firstName;
    user.lastName = lastName;
    changed = true;
  }

  if (changed) {
    await user.save();
    logger.info("Admin account synced from env", { email: normalizedEmail });
  }
};

module.exports = { ensureAdminAccount };
