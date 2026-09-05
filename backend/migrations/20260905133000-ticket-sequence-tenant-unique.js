/**
 * Migration: TicketSequence uniqueness becomes tenant-aware WHILE keeping the
 * legacy (applicationCode, year) unique index so generateTicketNumber() continues
 * to work without tenant context in Phase 3.
 *
 * Adds unique compound index: { tenantId: 1, applicationCode: 1, year: 1 }
 * Does NOT drop applicationCode_1_year_1 (Phase 4+ when numbering is tenant-scoped).
 */

const { ObjectId } = require("mongodb");
const { resolveElvaTenantId, missingTenantFilter } = require("../src/shared/migration/tenant-backfill");

const COLLECTION = "ticketsequences";
const COMPOUND_INDEX_NAME = "tenantId_1_applicationCode_1_year_1";

module.exports = {
  async up(db) {
    const elvaId = await resolveElvaTenantId(db);
    const collection = db.collection(COLLECTION);

    const missing = await collection.countDocuments(missingTenantFilter);
    if (missing > 0) {
      throw new Error(
        `Refusing ticket sequence index migration: ${missing} ticketsequences missing tenantId`
      );
    }

    const duplicates = await collection
      .aggregate([
        {
          $group: {
            _id: {
              tenantId: "$tenantId",
              applicationCode: "$applicationCode",
              year: "$year"
            },
            count: { $sum: 1 }
          }
        },
        { $match: { count: { $gt: 1 } } }
      ])
      .toArray();

    if (duplicates.length > 0) {
      throw new Error(
        `Duplicate (tenantId, applicationCode, year) groups: ${JSON.stringify(duplicates)}`
      );
    }

    const indexes = await collection.indexes();
    if (!indexes.some((idx) => idx.name === COMPOUND_INDEX_NAME)) {
      await collection.createIndex(
        { tenantId: 1, applicationCode: 1, year: 1 },
        { unique: true, name: COMPOUND_INDEX_NAME }
      );
      console.log(`[index] created ${COMPOUND_INDEX_NAME}`);
    }

    // Preserve legacy unique index for Phase 3 compatibility.
    const legacy = indexes.find((idx) => idx.name === "applicationCode_1_year_1");
    console.log("[ticket-sequence] legacy index preserved", {
      name: legacy?.name || "applicationCode_1_year_1",
      unique: legacy?.unique,
      note: "generateTicketNumber still keys by applicationCode+year"
    });

    const withElva = await collection.countDocuments({ tenantId: new ObjectId(elvaId) });
    console.log("[ticket-sequence] migration complete", {
      total: await collection.countDocuments(),
      withElvaTenant: withElva
    });
  },

  async down(db) {
    const collection = db.collection(COLLECTION);
    const indexes = await collection.indexes();
    if (indexes.some((idx) => idx.name === COMPOUND_INDEX_NAME)) {
      await collection.dropIndex(COMPOUND_INDEX_NAME);
      console.log(`[index] dropped ${COMPOUND_INDEX_NAME}`);
    }
  }
};
