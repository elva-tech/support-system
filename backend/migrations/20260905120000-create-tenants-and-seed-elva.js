/**
 * Migration: create tenants collection indexes + seed ELVA Technologies tenant.
 *
 * Safe / additive only:
 * - Does NOT modify Users, Applications, Modules, Teams, Merchants, Tickets, etc.
 * - Does NOT add tenantId to any existing collection.
 * - ELVA seed is idempotent (keyed by slug "elva").
 *
 * Indexes:
 * - slug unique — subdomain identity + duplicate prevention
 * - status — future filtering of active/suspended tenants
 */

const ELVA_SLUG = "elva";
const ELVA_NAME = "ELVA Technologies";
const ELVA_STATUS = "ACTIVE";

const defaultSettings = () => ({
  organization: {},
  branding: {},
  notifications: {}
});

module.exports = {
  async up(db) {
    const tenants = db.collection("tenants");

    await tenants.createIndex({ slug: 1 }, { unique: true, name: "slug_1" });
    await tenants.createIndex({ status: 1 }, { name: "status_1" });

    const existing = await tenants.findOne({ slug: ELVA_SLUG });
    if (!existing) {
      const now = new Date();
      await tenants.insertOne({
        name: ELVA_NAME,
        slug: ELVA_SLUG,
        status: ELVA_STATUS,
        settings: defaultSettings(),
        createdAt: now,
        updatedAt: now
      });
    }
  },

  async down(db) {
    const tenants = db.collection("tenants");

    // Remove only the seeded ELVA tenant (do not wipe other tenants if any).
    await tenants.deleteOne({ slug: ELVA_SLUG, name: ELVA_NAME });

    const indexes = await tenants.indexes().catch(() => []);
    const names = new Set(indexes.map((idx) => idx.name));

    if (names.has("status_1")) {
      await tenants.dropIndex("status_1");
    }
    if (names.has("slug_1")) {
      await tenants.dropIndex("slug_1");
    }
  }
};
