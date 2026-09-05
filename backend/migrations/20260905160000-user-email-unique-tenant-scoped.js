/**
 * Migration: User email uniqueness → tenant-scoped { tenantId, email }.
 *
 * SAFE ORDER:
 * 1. Ensure every user has tenantId
 * 2. Detect duplicate (tenantId, email) within a tenant
 * 3. Create compound unique index
 * 4. Drop legacy global unique email index
 */

const { ObjectId } = require("mongodb");
const { resolveElvaTenantId, missingTenantFilter } = require("../src/shared/migration/tenant-backfill");

const COLLECTION = "users";
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
      // Backfill remaining users to ELVA before index change
      const result = await collection.updateMany(missingTenantFilter, {
        $set: { tenantId: new ObjectId(elvaId) }
      });
      console.log(`[users] backfilled tenantId on ${result.modifiedCount} users before email index migration`);
    }

    const stillMissing = await collection.countDocuments(missingTenantFilter);
    if (stillMissing > 0) {
      throw new Error(
        `Refusing user email index migration: ${stillMissing} users still missing tenantId`
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
        `Refusing user email index migration: duplicate (tenantId, email) groups=${JSON.stringify(duplicates)}`
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

    console.log("[users-email-index] migration complete", {
      compoundIndex: COMPOUND_INDEX_NAME,
      dropped: emailUniques.map((i) => i.name)
    });
  },

  async down(db) {
    const collection = db.collection(COLLECTION);
    const indexes = await collection.indexes();

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

    if (
      !indexes.some(
        (idx) => idx.unique && idx.key && idx.key.email === 1 && Object.keys(idx.key).length === 1
      )
    ) {
      await collection.createIndex({ email: 1 }, { unique: true, name: "email_1" });
      console.log("[index] restored email_1 unique on users");
    }

    if (indexes.some((idx) => idx.name === COMPOUND_INDEX_NAME)) {
      await collection.dropIndex(COMPOUND_INDEX_NAME);
      console.log(`[index] dropped ${COMPOUND_INDEX_NAME}`);
    }
  }
};
