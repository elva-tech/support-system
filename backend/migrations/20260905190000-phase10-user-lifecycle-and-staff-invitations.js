/**
 * Phase 10: User lifecycle status backfill + staff invitation indexes.
 * Idempotent. Existing active users remain ACTIVE (never INVITED).
 */

module.exports = {
  async up(db) {
    const users = db.collection("users");
    const tenantAdminInvitations = db.collection("tenantadmininvitations");
    const staffInvitations = db.collection("staffinvitations");

    // Ensure indexes for staff invitations
    await staffInvitations.createIndex({ tokenHash: 1 }, { unique: true, name: "tokenHash_1" });
    await staffInvitations.createIndex(
      { tenantId: 1, status: 1, createdAt: -1 },
      { name: "tenantId_1_status_1_createdAt_-1" }
    );
    await staffInvitations.createIndex(
      { tenantId: 1, userId: 1, status: 1 },
      { name: "tenantId_1_userId_1_status_1" }
    );
    await staffInvitations.createIndex({ expiresAt: 1 }, { name: "expiresAt_1" });
    await staffInvitations.createIndex({ email: 1 }, { name: "email_1" });

    await users.createIndex({ tenantId: 1, status: 1 }, { name: "tenantId_1_status_1" });

    // Pending invitations → INVITED (before generic inactive backfill)
    const pendingAdminUserIds = await tenantAdminInvitations.distinct("userId", {
      status: "PENDING"
    });
    const pendingStaffUserIds = await staffInvitations.distinct("userId", {
      status: "PENDING"
    });
    const invitedIds = [...new Set([...pendingAdminUserIds, ...pendingStaffUserIds].map(String))];

    if (invitedIds.length) {
      const { ObjectId } = require("mongodb");
      await users.updateMany(
        {
          _id: { $in: invitedIds.map((id) => new ObjectId(id)) },
          $or: [{ status: { $exists: false } }, { status: null }]
        },
        { $set: { status: "INVITED", isActive: false } }
      );
    }

    const activeResult = await users.updateMany(
      {
        isActive: true,
        $or: [{ status: { $exists: false } }, { status: null }]
      },
      { $set: { status: "ACTIVE" } }
    );

    const deactivatedResult = await users.updateMany(
      {
        isActive: false,
        $or: [{ status: { $exists: false } }, { status: null }]
      },
      { $set: { status: "DEACTIVATED" } }
    );

    console.log(
      `[phase-10] user status backfill: ACTIVE=${activeResult.modifiedCount}, DEACTIVATED=${deactivatedResult.modifiedCount}, pendingInvites=${invitedIds.length}`
    );
  },

  async down(db) {
    const staffInvitations = db.collection("staffinvitations");
    const users = db.collection("users");

    for (const name of [
      "tokenHash_1",
      "tenantId_1_status_1_createdAt_-1",
      "tenantId_1_userId_1_status_1",
      "expiresAt_1",
      "email_1"
    ]) {
      const indexes = await staffInvitations.indexes().catch(() => []);
      if (indexes.some((i) => i.name === name)) {
        await staffInvitations.dropIndex(name);
      }
    }

    const userIndexes = await users.indexes().catch(() => []);
    if (userIndexes.some((i) => i.name === "tenantId_1_status_1")) {
      await users.dropIndex("tenantId_1_status_1");
    }

    // Do not unset status on down — leaving the field is safer for rollback.
    console.log("[phase-10] rolled back staff invitation indexes (status field retained)");
  }
};
