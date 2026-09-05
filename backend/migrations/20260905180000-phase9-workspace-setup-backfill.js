/**
 * Phase 9: backfill workspace setup fields on tenants.
 *
 * - Ensures every tenant has setup.{status,steps,skipped,completedAt}
 * - Marks ELVA (slug=elva) COMPLETED when it already has operational data
 *   (teams + applications), so existing admins are not forced through onboarding.
 * - New/empty tenants remain NOT_STARTED.
 *
 * Safe / additive. Does not delete tenant settings or operational data.
 */

const {
  WORKSPACE_SETUP_STATUSES,
  REQUIRED_SETUP_STEPS
} = require("../src/shared/constants/workspace-setup");

const ELVA_SLUG = "elva";

const organizationComplete = (org = {}) => {
  const displayName = String(org.displayName || org.name || "").trim();
  const supportEmail = String(org.supportEmail || org.primaryContactEmail || "").trim();
  return Boolean(displayName) && Boolean(supportEmail);
};

module.exports = {
  async up(db) {
    const tenants = db.collection("tenants");
    const teams = db.collection("teams");
    const applications = db.collection("applications");
    const users = db.collection("users");
    const merchants = db.collection("merchantprofiles");

    await tenants.createIndex({ "setup.status": 1 }, { name: "setup_status_1" }).catch(() => {});

    const cursor = tenants.find({});
    while (await cursor.hasNext()) {
      const tenant = await cursor.next();
      const tenantId = tenant._id;
      const org = tenant.settings?.organization || {};
      const branding = tenant.settings?.branding || {};

      const [teamCount, appCount, userCount, clientCount] = await Promise.all([
        teams.countDocuments({ tenantId, isActive: { $ne: false } }),
        applications.countDocuments({ tenantId, isActive: { $ne: false } }),
        users.countDocuments({ tenantId, isActive: { $ne: false } }),
        merchants.countDocuments({ tenantId, isActive: { $ne: false } })
      ]);

      const steps = {
        organization:
          organizationComplete(org) ||
          (tenant.slug === ELVA_SLUG && Boolean(tenant.name)),
        branding: Boolean(
          String(branding.supportDisplayName || "").trim() || branding.logoFileId
        ),
        team: teamCount >= 1,
        application: appCount >= 1,
        users: userCount >= 2,
        client: clientCount >= 1
      };

      // ELVA: treat organization as complete from tenant name when operational
      if (tenant.slug === ELVA_SLUG && (teamCount >= 1 || appCount >= 1)) {
        steps.organization = true;
        steps.branding = steps.branding || true; // ELVA default branding is fine
        steps.users = steps.users || userCount >= 1;
      }

      const requiredDone = REQUIRED_SETUP_STEPS.every((key) => steps[key]);
      const anyStep = Object.values(steps).some(Boolean);

      let status = WORKSPACE_SETUP_STATUSES.NOT_STARTED;
      let completedAt = null;
      if (requiredDone) {
        status = WORKSPACE_SETUP_STATUSES.COMPLETED;
        completedAt = new Date();
      } else if (anyStep) {
        status = WORKSPACE_SETUP_STATUSES.IN_PROGRESS;
      }

      // Prefer COMPLETED for already-operational ELVA
      if (tenant.slug === ELVA_SLUG && (teamCount >= 1 && appCount >= 1)) {
        status = WORKSPACE_SETUP_STATUSES.COMPLETED;
        completedAt = completedAt || new Date();
        steps.organization = true;
        steps.team = true;
        steps.application = true;
        steps.branding = true;
      }

      const settings = tenant.settings || {
        organization: {},
        branding: {},
        notifications: {}
      };

      if (tenant.slug === ELVA_SLUG) {
        settings.organization = {
          ...(settings.organization || {}),
          name: settings.organization?.name || tenant.name,
          displayName: settings.organization?.displayName || tenant.name,
          supportEmail:
            settings.organization?.supportEmail ||
            process.env.EMAIL_SUPPORT_ADDRESS ||
            "support@elvatech.in"
        };
        settings.branding = {
          ...(settings.branding || {}),
          supportDisplayName: settings.branding?.supportDisplayName || "ELVA Support"
        };
      }

      await tenants.updateOne(
        { _id: tenantId },
        {
          $set: {
            settings,
            setup: {
              status,
              steps,
              skipped: { branding: false, users: false, client: false },
              completedAt
            },
            updatedAt: new Date()
          }
        }
      );
    }
  },

  async down(db) {
    const tenants = db.collection("tenants");
    await tenants.updateMany({}, { $unset: { setup: "" } });

    const indexes = await tenants.indexes().catch(() => []);
    const names = new Set(indexes.map((idx) => idx.name));
    if (names.has("setup_status_1")) {
      await tenants.dropIndex("setup_status_1");
    }
  }
};
