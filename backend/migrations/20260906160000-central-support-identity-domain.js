/**
 * Central Support identity domain + clear invalid platform-admin ticket assignments.
 */

module.exports = {
  async up(db) {
    await db.collection("centralsupportusers").createIndex({ email: 1 }, { unique: true });
    await db.collection("centralsupportusers").createIndex({ status: 1, role: 1 });
    await db.collection("centralsupportusers").createIndex({ teamId: 1, status: 1 });

    await db.collection("centralsupportteams").createIndex({ name: 1 }, { unique: true });
    await db.collection("centralsupportteams").createIndex({ isActive: 1 });

    await db
      .collection("platformsupporttickets")
      .createIndex({ assignedCentralSupportUserId: 1, status: 1 });
    await db
      .collection("platformsupporttickets")
      .createIndex({ assignedCentralSupportTeamId: 1, status: 1 });

    // Clear invalid Platform Admin assignments — tickets return to unassigned queue
    await db.collection("platformsupporttickets").updateMany(
      {
        $or: [
          { assignedPlatformAdminId: { $ne: null } },
          { assignedPlatformAdminName: { $ne: null } }
        ]
      },
      {
        $set: {
          assignedPlatformAdminId: null,
          assignedPlatformAdminName: null,
          assignedCentralSupportUserId: null,
          assignedCentralSupportUserName: null,
          assignedCentralSupportTeamId: null,
          assignedCentralSupportTeamName: null,
          assignedAt: null
        }
      }
    );
  },

  async down(db) {
    await db.collection("centralsupportusers").drop().catch(() => undefined);
    await db.collection("centralsupportteams").drop().catch(() => undefined);
  }
};
