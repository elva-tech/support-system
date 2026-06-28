const env = require("../config/env");
const logger = require("../shared/utils/logger");
const User = require("../modules/users/user.model");
const { ROLES } = require("../shared/constants/roles");

/**
 * Ensures the admin account from env exists on every server start.
 * Never deletes or re-seeds applications, teams, or other data.
 */
const ensureAdminAccount = async () => {
  const { email, password, firstName, lastName } = env.admin;
  const normalizedEmail = email.toLowerCase();

  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    await User.create({
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
