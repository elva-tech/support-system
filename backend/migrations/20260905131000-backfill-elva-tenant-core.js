/**
 * Migration: backfill ELVA tenantId onto core collections.
 * Idempotent — only updates documents missing tenantId.
 * Fails loudly if any target document remains without tenantId.
 */

const {
  resolveElvaTenantId,
  backfillCollection,
  unsetElvaTenantId
} = require("../src/shared/migration/tenant-backfill");

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
    const elvaId = await resolveElvaTenantId(db);
    const summaries = [];

    for (const name of CORE_COLLECTIONS) {
      summaries.push(await backfillCollection(db, name, elvaId));
    }

    console.log("[backfill] core collections complete", {
      tenantId: String(elvaId),
      summaries
    });
  },

  async down(db) {
    // Safe only while this environment has a single tenant (ELVA).
    // Unsets tenantId only where it equals the ELVA tenant id.
    const elvaId = await resolveElvaTenantId(db);
    for (const name of CORE_COLLECTIONS) {
      await unsetElvaTenantId(db, name, elvaId);
    }
  }
};
