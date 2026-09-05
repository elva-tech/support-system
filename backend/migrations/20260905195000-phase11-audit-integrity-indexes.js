/**
 * Phase 11: Audit list indexes for tenant-scoped queries.
 * Idempotent.
 */

module.exports = {
  async up(db) {
    const auditlogs = db.collection("auditlogs");
    await auditlogs.createIndex(
      { tenantId: 1, createdAt: -1 },
      { name: "tenantId_1_createdAt_-1" }
    );
    await auditlogs.createIndex(
      { tenantId: 1, action: 1, createdAt: -1 },
      { name: "tenantId_1_action_1_createdAt_-1" }
    );
    await auditlogs.createIndex(
      { tenantId: 1, entityType: 1, createdAt: -1 },
      { name: "tenantId_1_entityType_1_createdAt_-1" }
    );

    const platform = db.collection("platformauditlogs");
    await platform.createIndex(
      { action: 1, createdAt: -1 },
      { name: "action_1_createdAt_-1" }
    );
    await platform.createIndex(
      { targetType: 1, createdAt: -1 },
      { name: "targetType_1_createdAt_-1" }
    );

    console.log("[phase-11] audit indexes ensured");
  },

  async down(db) {
    const drops = [
      ["auditlogs", ["tenantId_1_createdAt_-1", "tenantId_1_action_1_createdAt_-1", "tenantId_1_entityType_1_createdAt_-1"]],
      ["platformauditlogs", ["action_1_createdAt_-1", "targetType_1_createdAt_-1"]]
    ];
    for (const [coll, names] of drops) {
      const collection = db.collection(coll);
      const indexes = await collection.indexes().catch(() => []);
      const existing = new Set(indexes.map((i) => i.name));
      for (const name of names) {
        if (existing.has(name)) {
          await collection.dropIndex(name);
        }
      }
    }
  }
};
