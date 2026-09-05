/**
 * Drop legacy TicketSequence unique (applicationCode, year).
 * Compound unique (tenantId, applicationCode, year) must already exist (Phase 3).
 * Requires every sequence document to have tenantId.
 */

const { resolveElvaTenantId, missingTenantFilter } = require("../src/shared/migration/tenant-backfill");

const COLLECTION = "ticketsequences";
const LEGACY_INDEX = "applicationCode_1_year_1";
const COMPOUND_INDEX = "tenantId_1_applicationCode_1_year_1";

module.exports = {
  async up(db) {
    const collection = db.collection(COLLECTION);
    await resolveElvaTenantId(db);

    const missing = await collection.countDocuments(missingTenantFilter);
    if (missing > 0) {
      throw new Error(
        `Refusing to drop legacy sequence index: ${missing} ticketsequences missing tenantId`
      );
    }

    const indexes = await collection.indexes();
    if (!indexes.some((idx) => idx.name === COMPOUND_INDEX && idx.unique)) {
      await collection.createIndex(
        { tenantId: 1, applicationCode: 1, year: 1 },
        { unique: true, name: COMPOUND_INDEX }
      );
      console.log(`[index] ensured ${COMPOUND_INDEX}`);
    }

    if (indexes.some((idx) => idx.name === LEGACY_INDEX)) {
      await collection.dropIndex(LEGACY_INDEX);
      console.log(`[index] dropped legacy ${LEGACY_INDEX}`);
    } else {
      console.log(`[index] legacy ${LEGACY_INDEX} already absent`);
    }
  },

  async down(db) {
    const collection = db.collection(COLLECTION);
    const indexes = await collection.indexes();

    // Restoring legacy unique is only safe when no two tenants share applicationCode+year.
    const dupes = await collection
      .aggregate([
        {
          $group: {
            _id: { applicationCode: "$applicationCode", year: "$year" },
            count: { $sum: 1 }
          }
        },
        { $match: { count: { $gt: 1 } } }
      ])
      .toArray();

    if (dupes.length > 0) {
      throw new Error(
        `Cannot restore ${LEGACY_INDEX}: cross-tenant applicationCode+year collisions exist`
      );
    }

    if (!indexes.some((idx) => idx.name === LEGACY_INDEX)) {
      await collection.createIndex(
        { applicationCode: 1, year: 1 },
        { unique: true, name: LEGACY_INDEX }
      );
      console.log(`[index] restored ${LEGACY_INDEX}`);
    }
  }
};
