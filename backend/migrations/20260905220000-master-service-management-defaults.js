/**
 * Master feature: backfill tenant service-management defaults.
 *
 * - Additive only: sets settings.serviceManagement when missing
 * - Does NOT overwrite existing serviceManagement configuration
 * - Idempotent / safe for re-run
 * - Existing tickets without SLA are left unchanged (no retroactive cycles)
 */

const { defaultServiceManagement } = require("../src/shared/constants/service-management");

module.exports = {
  async up(db) {
    const tenants = db.collection("tenants");
    const defaults = defaultServiceManagement();

    const cursor = tenants.find({
      $or: [
        { "settings.serviceManagement": { $exists: false } },
        { "settings.serviceManagement": null }
      ]
    });

    let updated = 0;
    while (await cursor.hasNext()) {
      const tenant = await cursor.next();
      await tenants.updateOne(
        { _id: tenant._id },
        { $set: { "settings.serviceManagement": defaults } }
      );
      updated += 1;
    }

    // Helpful SLA worker query index (ignored if already exists)
    try {
      await db.collection("tickets").createIndex(
        { tenantId: 1, "sla.currentCycle.resolutionDueAt": 1, status: 1 },
        { name: "tenant_sla_resolution_due", background: true }
      );
    } catch {
      // index may already exist with another name
    }

    return { tenantsUpdated: updated };
  },

  async down() {
    // Non-destructive: leave serviceManagement in place
  }
};
