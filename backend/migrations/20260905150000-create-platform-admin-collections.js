/**
 * Migration: create platformadmins + platformauditlogs indexes.
 * Additive only — does not touch tenant collections.
 */

module.exports = {
  async up(db) {
    const admins = db.collection("platformadmins");
    await admins.createIndex({ email: 1 }, { unique: true, name: "email_1" });
    await admins.createIndex({ status: 1, role: 1 }, { name: "status_1_role_1" });

    const audits = db.collection("platformauditlogs");
    await audits.createIndex({ createdAt: -1 }, { name: "createdAt_-1" });
    await audits.createIndex({ action: 1, createdAt: -1 }, { name: "action_1_createdAt_-1" });
    await audits.createIndex(
      { actorPlatformAdminId: 1, createdAt: -1 },
      { name: "actorPlatformAdminId_1_createdAt_-1" }
    );

    console.log("[platform] indexes ensured for platformadmins and platformauditlogs");
  },

  async down(db) {
    for (const [name, indexNames] of [
      ["platformadmins", ["email_1", "status_1_role_1"]],
      [
        "platformauditlogs",
        ["createdAt_-1", "action_1_createdAt_-1", "actorPlatformAdminId_1_createdAt_-1"]
      ]
    ]) {
      const collection = db.collection(name);
      const indexes = await collection.indexes().catch(() => []);
      const existing = new Set(indexes.map((i) => i.name));
      for (const indexName of indexNames) {
        if (existing.has(indexName)) {
          await collection.dropIndex(indexName);
        }
      }
    }
  }
};
