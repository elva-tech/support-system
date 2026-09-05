/**
 * Phase 15: bind OTP sessions to tenantId (cross-tenant email collision fix).
 * Additive index only — no data wipe. Legacy sessions without tenantId expire via TTL.
 */

module.exports = {
  async up(db) {
    const col = db.collection("otpsessions");
    await col.createIndex({ tenantId: 1 }, { name: "tenantId_1", background: true });
    await col.createIndex(
      { email: 1, tenantId: 1, createdAt: -1 },
      { name: "email_1_tenantId_1_createdAt_-1", background: true }
    );
  },

  async down(db) {
    const col = db.collection("otpsessions");
    try {
      await col.dropIndex("email_1_tenantId_1_createdAt_-1");
    } catch (_err) {
      /* index may not exist */
    }
    try {
      await col.dropIndex("tenantId_1");
    } catch (_err) {
      /* index may not exist */
    }
  }
};
