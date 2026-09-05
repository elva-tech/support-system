/**
 * Migration: tenantId indexes + ELVA backfill for operational collections.
 *
 * Direct ownership:
 * - email_threads
 * - inbound_mail_queue
 * - classification_queue
 * - application_profiles
 * - notificationevents
 * - notificationdeliveries
 * - auditlogs
 * - merchantsessions
 *
 * Inherited (no tenantId in this phase): modules, ticketconversations, attachments
 * Not tenant-relevant yet: otpsessions (TTL / transient)
 */

const {
  resolveElvaTenantId,
  backfillCollection,
  ensureTenantIdIndex,
  unsetElvaTenantId
} = require("../src/shared/migration/tenant-backfill");

const OPERATIONAL_COLLECTIONS = [
  "email_threads",
  "inbound_mail_queue",
  "classification_queue",
  "application_profiles",
  "notificationevents",
  "notificationdeliveries",
  "auditlogs",
  "merchantsessions"
];

module.exports = {
  async up(db) {
    const elvaId = await resolveElvaTenantId(db);

    for (const name of OPERATIONAL_COLLECTIONS) {
      // Ensure collection exists (createIndex on empty is fine; some envs may have 0 docs)
      await ensureTenantIdIndex(db.collection(name));
    }

    const summaries = [];
    for (const name of OPERATIONAL_COLLECTIONS) {
      summaries.push(await backfillCollection(db, name, elvaId));
    }

    console.log("[backfill] operational collections complete", {
      tenantId: String(elvaId),
      summaries
    });
  },

  async down(db) {
    const elvaId = await resolveElvaTenantId(db);
    for (const name of OPERATIONAL_COLLECTIONS) {
      await unsetElvaTenantId(db, name, elvaId);
      const collection = db.collection(name);
      const indexes = await collection.indexes().catch(() => []);
      if (indexes.some((idx) => idx.name === "tenantId_1")) {
        await collection.dropIndex("tenantId_1");
      }
    }
  }
};
