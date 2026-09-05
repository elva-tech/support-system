/**
 * Migration: add sparse tenantId indexes on core tenant-owned collections.
 * Does not modify documents. Does not change uniqueness rules.
 *
 * Collections:
 * - users, applications, teams, merchantprofiles, tickets, ticketsequences
 */

const { ensureTenantIdIndex } = require("../src/shared/migration/tenant-backfill");

const CORE_COLLECTIONS = [
  "users",
  "applications",
  "teams",
  "merchantprofiles",
  "tickets",
  "ticketsequences"
];

module.exports = {
  async up(db) {
    for (const name of CORE_COLLECTIONS) {
      await ensureTenantIdIndex(db.collection(name));
      console.log(`[index] ensured tenantId_1 on ${name}`);
    }
  },

  async down(db) {
    for (const name of CORE_COLLECTIONS) {
      const collection = db.collection(name);
      const indexes = await collection.indexes().catch(() => []);
      if (indexes.some((idx) => idx.name === "tenantId_1")) {
        await collection.dropIndex("tenantId_1");
        console.log(`[index] dropped tenantId_1 on ${name}`);
      }
    }
  }
};
