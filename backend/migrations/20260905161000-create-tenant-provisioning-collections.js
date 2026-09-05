/**
 * Migration: tenantprovisionings + tenantadmininvitations indexes (Phase 6).
 */

module.exports = {
  async up(db) {
    const provisionings = db.collection("tenantprovisionings");
    await provisionings.createIndex({ tenantId: 1 }, { unique: true, name: "tenantId_1" });
    await provisionings.createIndex({ status: 1, createdAt: -1 }, { name: "status_1_createdAt_-1" });
    await provisionings.createIndex({ tenantSlug: 1 }, { name: "tenantSlug_1" });
    await provisionings.createIndex({ tenantAdminEmail: 1 }, { name: "tenantAdminEmail_1" });

    const invitations = db.collection("tenantadmininvitations");
    await invitations.createIndex({ tokenHash: 1 }, { unique: true, name: "tokenHash_1" });
    await invitations.createIndex({ tenantId: 1, status: 1 }, { name: "tenantId_1_status_1" });
    await invitations.createIndex({ userId: 1 }, { name: "userId_1" });
    await invitations.createIndex({ expiresAt: 1 }, { name: "expiresAt_1" });
    await invitations.createIndex({ provisioningId: 1 }, { name: "provisioningId_1" });

    console.log("[provisioning] indexes ensured for tenantprovisionings and tenantadmininvitations");
  },

  async down(db) {
    for (const [name, indexNames] of [
      [
        "tenantprovisionings",
        ["tenantId_1", "status_1_createdAt_-1", "tenantSlug_1", "tenantAdminEmail_1"]
      ],
      [
        "tenantadmininvitations",
        ["tokenHash_1", "tenantId_1_status_1", "userId_1", "expiresAt_1", "provisioningId_1"]
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
