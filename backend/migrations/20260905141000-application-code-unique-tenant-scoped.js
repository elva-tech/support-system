/**
 * Application.code uniqueness → tenant-scoped (tenantId + code).
 * Safe order: validate tenantId present → create compound unique → drop global code unique.
 */

const { ObjectId } = require("mongodb");
const { resolveElvaTenantId, missingTenantFilter } = require("../src/shared/migration/tenant-backfill");

const COLLECTION = "applications";
const COMPOUND_INDEX = "tenantId_1_code_1";

const findCodeUniqueIndexes = (indexes) =>
  indexes.filter((idx) => {
    if (!idx.unique) return false;
    const keys = Object.keys(idx.key || {});
    return keys.length === 1 && keys[0] === "code";
  });

module.exports = {
  async up(db) {
    const elvaId = await resolveElvaTenantId(db);
    const collection = db.collection(COLLECTION);

    const missing = await collection.countDocuments(missingTenantFilter);
    if (missing > 0) {
      throw new Error(
        `Refusing application code index migration: ${missing} applications missing tenantId`
      );
    }

    const duplicates = await collection
      .aggregate([
        {
          $group: {
            _id: { tenantId: "$tenantId", code: "$code" },
            count: { $sum: 1 }
          }
        },
        { $match: { count: { $gt: 1 } } }
      ])
      .toArray();

    if (duplicates.length > 0) {
      throw new Error(
        `Duplicate (tenantId, code) groups: ${JSON.stringify(duplicates)}`
      );
    }

    const indexesBefore = await collection.indexes();
    if (!indexesBefore.some((idx) => idx.name === COMPOUND_INDEX)) {
      await collection.createIndex(
        { tenantId: 1, code: 1 },
        { unique: true, name: COMPOUND_INDEX }
      );
      console.log(`[index] created ${COMPOUND_INDEX}`);
    }

    const indexesMid = await collection.indexes();
    const codeUniques = findCodeUniqueIndexes(indexesMid);
    for (const idx of codeUniques) {
      await collection.dropIndex(idx.name);
      console.log(`[index] dropped legacy unique code index ${idx.name}`);
    }

    console.log("[application-code] migration complete", {
      total: await collection.countDocuments(),
      withElva: await collection.countDocuments({ tenantId: new ObjectId(elvaId) }),
      compoundIndex: COMPOUND_INDEX,
      dropped: codeUniques.map((i) => i.name)
    });
  },

  async down(db) {
    const collection = db.collection(COLLECTION);
    const indexes = await collection.indexes();

    const codeDupes = await collection
      .aggregate([
        { $group: { _id: "$code", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ])
      .toArray();

    if (codeDupes.length > 0) {
      throw new Error(
        `Cannot restore global code unique: cross-tenant duplicate codes exist (${codeDupes.length} groups)`
      );
    }

    if (!findCodeUniqueIndexes(indexes).length) {
      await collection.createIndex({ code: 1 }, { unique: true, name: "code_1" });
      console.log("[index] restored code_1 unique");
    }

    if (indexes.some((idx) => idx.name === COMPOUND_INDEX)) {
      await collection.dropIndex(COMPOUND_INDEX);
      console.log(`[index] dropped ${COMPOUND_INDEX}`);
    }
  }
};
