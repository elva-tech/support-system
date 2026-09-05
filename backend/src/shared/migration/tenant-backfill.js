/**
 * Shared helpers for Phase 3 tenant backfill migrations.
 * Kept outside backend/migrations/ so migrate-mongo does not treat this as a migration file.
 * Never hardcode tenant ObjectIds — always resolve by slug.
 */

const { ObjectId } = require("mongodb");

const ELVA_SLUG = "elva";

const missingTenantFilter = {
  $or: [{ tenantId: { $exists: false } }, { tenantId: null }]
};

const resolveElvaTenantId = async (db) => {
  const tenant = await db.collection("tenants").findOne({ slug: ELVA_SLUG });
  if (!tenant) {
    throw new Error(
      `ELVA tenant (slug="${ELVA_SLUG}") not found. Run Phase 2 migration first (create-tenants-and-seed-elva).`
    );
  }
  return tenant._id;
};

/**
 * Backfill tenantId for documents missing it. Does not overwrite existing tenantId.
 */
const backfillCollection = async (db, collectionName, tenantId, { extraFilter = {} } = {}) => {
  const collection = db.collection(collectionName);
  const before = await collection.countDocuments(extraFilter);
  const missingBefore = await collection.countDocuments({ ...extraFilter, ...missingTenantFilter });

  const result = await collection.updateMany(
    { ...extraFilter, ...missingTenantFilter },
    { $set: { tenantId } }
  );

  const withTenant = await collection.countDocuments({
    ...extraFilter,
    tenantId: new ObjectId(tenantId)
  });
  const missingAfter = await collection.countDocuments({ ...extraFilter, ...missingTenantFilter });
  const unexpected = await collection.countDocuments({
    ...extraFilter,
    tenantId: { $exists: true, $ne: null, $nin: [tenantId, new ObjectId(tenantId)] }
  });

  const summary = {
    collection: collectionName,
    before,
    missingBefore,
    updated: result.modifiedCount,
    matched: result.matchedCount,
    withElvaTenant: withTenant,
    missingAfter,
    unexpectedTenantId: unexpected
  };

  console.log(`[backfill] ${collectionName}`, summary);

  if (missingAfter > 0) {
    throw new Error(
      `Backfill validation failed for ${collectionName}: ${missingAfter} documents still missing tenantId`
    );
  }

  return summary;
};

const ensureTenantIdIndex = async (collection, indexName = "tenantId_1") => {
  try {
    const indexes = await collection.indexes();
    if (indexes.some((idx) => idx.name === indexName)) {
      return;
    }
  } catch (err) {
    // Empty DBs may not have the collection yet (NamespaceNotFound).
    if (err.codeName !== "NamespaceNotFound" && err.code !== 26) {
      throw err;
    }
  }
  await collection.createIndex({ tenantId: 1 }, { name: indexName, sparse: true });
};

const unsetElvaTenantId = async (db, collectionName, tenantId) => {
  const result = await db.collection(collectionName).updateMany(
    { tenantId: new ObjectId(tenantId) },
    { $unset: { tenantId: "" } }
  );
  console.log(`[rollback] unset tenantId on ${collectionName}`, {
    modified: result.modifiedCount
  });
  return result;
};

module.exports = {
  ELVA_SLUG,
  missingTenantFilter,
  resolveElvaTenantId,
  backfillCollection,
  ensureTenantIdIndex,
  unsetElvaTenantId
};
