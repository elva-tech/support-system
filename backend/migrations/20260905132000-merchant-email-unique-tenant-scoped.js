/**
 * Migration: MerchantProfile email uniqueness → tenant-scoped.
 *
 * SAFE ORDER (required):
 * 1. Verify every merchantprofile has tenantId (post-backfill)
 * 2. Detect duplicate (tenantId, email) violations
 * 3. Create unique compound index { tenantId: 1, email: 1 }
 * 4. Drop legacy global unique index on email (name discovered dynamically)
 *
 * NEVER drop the global email unique index before the compound index exists.
 */

const { ObjectId } = require("mongodb");
const { resolveElvaTenantId, missingTenantFilter } = require("../src/shared/migration/tenant-backfill");

const COLLECTION = "merchantprofiles";
const COMPOUND_INDEX_NAME = "tenantId_1_email_1";

const findEmailUniqueIndexes = (indexes) =>
  indexes.filter((idx) => {
    if (!idx.unique) return false;
    const keys = Object.keys(idx.key || {});
    return keys.length === 1 && keys[0] === "email";
  });

module.exports = {
  async up(db) {
    const elvaId = await resolveElvaTenantId(db);
    const collection = db.collection(COLLECTION);

    const missing = await collection.countDocuments(missingTenantFilter);
    if (missing > 0) {
      throw new Error(
        `Refusing merchant email index migration: ${missing} merchantprofiles still missing tenantId`
      );
    }

    const duplicates = await collection
      .aggregate([
        {
          $group: {
            _id: { tenantId: "$tenantId", email: "$email" },
            count: { $sum: 1 },
            ids: { $push: "$_id" }
          }
        },
        { $match: { count: { $gt: 1 } } }
      ])
      .toArray();

    if (duplicates.length > 0) {
      throw new Error(
        `Refusing merchant email index migration: duplicate (tenantId, email) groups=${JSON.stringify(duplicates)}`
      );
    }

    const indexesBefore = await collection.indexes();
    const hasCompound = indexesBefore.some((idx) => idx.name === COMPOUND_INDEX_NAME);
    if (!hasCompound) {
      await collection.createIndex(
        { tenantId: 1, email: 1 },
        { unique: true, name: COMPOUND_INDEX_NAME }
      );
      console.log(`[index] created ${COMPOUND_INDEX_NAME} on ${COLLECTION}`);
    } else {
      console.log(`[index] ${COMPOUND_INDEX_NAME} already exists on ${COLLECTION}`);
    }

    const indexesMid = await collection.indexes();
    if (!indexesMid.some((idx) => idx.name === COMPOUND_INDEX_NAME && idx.unique)) {
      throw new Error(`Compound unique index ${COMPOUND_INDEX_NAME} missing after create`);
    }

    const emailUniques = findEmailUniqueIndexes(indexesMid);
    for (const idx of emailUniques) {
      await collection.dropIndex(idx.name);
      console.log(`[index] dropped legacy unique email index ${idx.name}`);
    }

    const indexesAfter = await collection.indexes();
    const remainingEmailOnly = findEmailUniqueIndexes(indexesAfter);
    if (remainingEmailOnly.length > 0) {
      throw new Error(
        `Legacy email unique index(es) still present: ${remainingEmailOnly.map((i) => i.name).join(", ")}`
      );
    }

    const withElva = await collection.countDocuments({ tenantId: new ObjectId(elvaId) });
    const total = await collection.countDocuments();
    console.log("[merchant-index] migration complete", {
      total,
      withElvaTenant: withElva,
      compoundIndex: COMPOUND_INDEX_NAME,
      dropped: emailUniques.map((i) => i.name)
    });
  },

  async down(db) {
    const collection = db.collection(COLLECTION);
    const indexes = await collection.indexes();

    // Restore global email unique ONLY if no cross-tenant duplicate emails exist.
    const emailDupes = await collection
      .aggregate([
        { $group: { _id: "$email", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ])
      .toArray();

    if (emailDupes.length > 0) {
      throw new Error(
        `Cannot restore global email unique index: cross-tenant duplicate emails exist (${emailDupes.length} groups). Manual recovery required.`
      );
    }

    if (!indexes.some((idx) => idx.unique && idx.key && idx.key.email === 1 && Object.keys(idx.key).length === 1)) {
      await collection.createIndex({ email: 1 }, { unique: true, name: "email_1" });
      console.log("[index] restored email_1 unique on merchantprofiles");
    }

    if (indexes.some((idx) => idx.name === COMPOUND_INDEX_NAME)) {
      await collection.dropIndex(COMPOUND_INDEX_NAME);
      console.log(`[index] dropped ${COMPOUND_INDEX_NAME}`);
    }
  }
};
