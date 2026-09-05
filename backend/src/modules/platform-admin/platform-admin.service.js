const PlatformAdmin = require("./platform-admin.model");
const {
  PLATFORM_ROLES,
  PLATFORM_ADMIN_STATUSES,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../../shared/constants/platform");
const {
  platformAdminNotFound,
  platformAdminEmailExists,
  platformAccessDenied,
  lastSuperAdminProtected,
  invalidPlatformRole
} = require("./platform-admin.errors");
const {
  assertValidPlatformRole,
  assertValidPlatformAdminStatus,
  assertValidPlatformAdminName,
  assertValidPlatformAdminEmail,
  assertValidPlatformPassword,
  canAssignPlatformRole,
  toPublicPlatformAdmin
} = require("./platform-admin.validation");
const { logPlatformAudit } = require("./platform-audit.service");

const countActiveSuperAdmins = async (excludeId = null) => {
  const query = {
    role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN,
    status: PLATFORM_ADMIN_STATUSES.ACTIVE
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return PlatformAdmin.countDocuments(query);
};

const assertNotLastSuperAdminChange = async (admin, { nextRole, nextStatus }) => {
  const isActiveSuper =
    admin.role === PLATFORM_ROLES.PLATFORM_SUPER_ADMIN &&
    admin.status === PLATFORM_ADMIN_STATUSES.ACTIVE;

  if (!isActiveSuper) {
    return;
  }

  const demoting =
    nextRole !== undefined && nextRole !== PLATFORM_ROLES.PLATFORM_SUPER_ADMIN;
  const disabling =
    nextStatus !== undefined && nextStatus !== PLATFORM_ADMIN_STATUSES.ACTIVE;

  if (!demoting && !disabling) {
    return;
  }

  const others = await countActiveSuperAdmins(admin._id);
  if (others === 0) {
    throw lastSuperAdminProtected();
  }
};

const getById = async (id) => {
  const admin = await PlatformAdmin.findById(id);
  if (!admin) {
    throw platformAdminNotFound();
  }
  return admin;
};

const list = async ({ status, role, search, limit = 50, skip = 0 } = {}) => {
  const query = {};
  if (status) {
    assertValidPlatformAdminStatus(status);
    query.status = status;
  }
  if (role) {
    assertValidPlatformRole(role);
    query.role = role;
  }
  if (search) {
    const term = String(search).trim();
    if (term) {
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } }
      ];
    }
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeSkip = Math.max(parseInt(skip, 10) || 0, 0);

  const [items, total] = await Promise.all([
    PlatformAdmin.find(query).sort({ createdAt: -1 }).skip(safeSkip).limit(safeLimit),
    PlatformAdmin.countDocuments(query)
  ]);

  return {
    items: items.map(toPublicPlatformAdmin),
    total,
    limit: safeLimit,
    skip: safeSkip
  };
};

/**
 * Create a platform admin. Actor role controls who can create whom.
 * New admins are ACTIVE (no invitation workflow in Phase 5).
 */
const create = async (
  { name, email, password, role },
  { actor } = {}
) => {
  if (!actor) {
    throw platformAccessDenied();
  }

  const normalizedName = assertValidPlatformAdminName(name);
  const normalizedEmail = assertValidPlatformAdminEmail(email);
  const plainPassword = assertValidPlatformPassword(password);
  const normalizedRole = assertValidPlatformRole(role);

  if (!canAssignPlatformRole(actor.role, normalizedRole)) {
    throw platformAccessDenied();
  }

  const existing = await PlatformAdmin.findOne({ email: normalizedEmail });
  if (existing) {
    throw platformAdminEmailExists();
  }

  let admin;
  try {
    admin = await PlatformAdmin.create({
      name: normalizedName,
      email: normalizedEmail,
      password: plainPassword,
      role: normalizedRole,
      status: PLATFORM_ADMIN_STATUSES.ACTIVE,
      createdBy: actor._id
    });
  } catch (error) {
    if (error && error.code === 11000) {
      throw platformAdminEmailExists();
    }
    throw error;
  }

  await logPlatformAudit({
    actorPlatformAdminId: actor._id,
    actorEmail: actor.email,
    action: PLATFORM_AUDIT_ACTIONS.PLATFORM_ADMIN_CREATED,
    targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_ADMIN,
    targetId: admin._id,
    metadata: { email: admin.email, role: admin.role }
  });

  return toPublicPlatformAdmin(admin);
};

/**
 * Patch name / role / status. Slug N/A. Password change not in Phase 5 public API.
 * PLATFORM_SUPPORT cannot manage admins (enforced at route).
 * PLATFORM_ADMIN cannot promote to SUPER_ADMIN.
 */
const update = async (adminId, payload, { actor } = {}) => {
  if (!actor) {
    throw platformAccessDenied();
  }

  const admin = await getById(adminId);
  const next = {};

  if (payload.name !== undefined) {
    next.name = assertValidPlatformAdminName(payload.name);
  }

  if (payload.role !== undefined) {
    const role = assertValidPlatformRole(payload.role);
    if (!canAssignPlatformRole(actor.role, role)) {
      throw platformAccessDenied();
    }
    // PLATFORM_ADMIN cannot change a SUPER_ADMIN's role either
    if (
      actor.role !== PLATFORM_ROLES.PLATFORM_SUPER_ADMIN &&
      admin.role === PLATFORM_ROLES.PLATFORM_SUPER_ADMIN
    ) {
      throw platformAccessDenied();
    }
    next.role = role;
  }

  if (payload.status !== undefined) {
    const status = assertValidPlatformAdminStatus(payload.status);
    if (actor.role !== PLATFORM_ROLES.PLATFORM_SUPER_ADMIN) {
      // Only super admin may suspend/disable others (and never last super)
      if (
        status !== PLATFORM_ADMIN_STATUSES.ACTIVE ||
        admin.role === PLATFORM_ROLES.PLATFORM_SUPER_ADMIN
      ) {
        throw platformAccessDenied();
      }
    }
    next.status = status;
  }

  await assertNotLastSuperAdminChange(admin, {
    nextRole: next.role,
    nextStatus: next.status
  });

  const previousRole = admin.role;
  const previousStatus = admin.status;

  Object.assign(admin, next);
  await admin.save();

  if (next.role && next.role !== previousRole) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action: PLATFORM_AUDIT_ACTIONS.PLATFORM_ADMIN_ROLE_CHANGED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_ADMIN,
      targetId: admin._id,
      metadata: { from: previousRole, to: next.role }
    });
  }

  if (next.status && next.status !== previousStatus) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action: PLATFORM_AUDIT_ACTIONS.PLATFORM_ADMIN_STATUS_CHANGED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_ADMIN,
      targetId: admin._id,
      metadata: { from: previousStatus, to: next.status }
    });
  }

  if (next.name) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action: PLATFORM_AUDIT_ACTIONS.PLATFORM_ADMIN_UPDATED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_ADMIN,
      targetId: admin._id,
      metadata: { fields: ["name"] }
    });
  }

  return toPublicPlatformAdmin(admin);
};

/**
 * Idempotent bootstrap of the first PLATFORM_SUPER_ADMIN from env credentials.
 * Does not log the password. Does not run on API startup — call from CLI script only.
 */
const ensureBootstrapSuperAdmin = async ({ name, email, password }) => {
  const normalizedEmail = assertValidPlatformAdminEmail(email);
  const existing = await PlatformAdmin.findOne({ email: normalizedEmail });

  if (existing) {
    return { admin: toPublicPlatformAdmin(existing), created: false };
  }

  const normalizedName = assertValidPlatformAdminName(name || "Platform Super Admin");
  const plainPassword = assertValidPlatformPassword(password);

  const admin = await PlatformAdmin.create({
    name: normalizedName,
    email: normalizedEmail,
    password: plainPassword,
    role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN,
    status: PLATFORM_ADMIN_STATUSES.ACTIVE,
    createdBy: null
  });

  await logPlatformAudit({
    actorPlatformAdminId: admin._id,
    actorEmail: admin.email,
    action: PLATFORM_AUDIT_ACTIONS.PLATFORM_ADMIN_CREATED,
    targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_ADMIN,
    targetId: admin._id,
    metadata: { bootstrap: true, role: admin.role }
  });

  return { admin: toPublicPlatformAdmin(admin), created: true };
};

module.exports = {
  getById,
  list,
  create,
  update,
  countActiveSuperAdmins,
  ensureBootstrapSuperAdmin,
  toPublicPlatformAdmin
};
