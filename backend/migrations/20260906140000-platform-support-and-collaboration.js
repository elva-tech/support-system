/**
 * Indexes for platform support + collaboration enquiry collections.
 */
module.exports = {
  async up(db) {
    const tickets = db.collection("platformsupporttickets");
    await tickets.createIndex({ ticketNumber: 1 }, { unique: true, name: "ticketNumber_1" });
    await tickets.createIndex({ status: 1, createdAt: -1 }, { name: "status_1_createdAt_-1" });
    await tickets.createIndex(
      { sourceTenantId: 1, createdAt: -1 },
      { name: "sourceTenantId_1_createdAt_-1" }
    );
    await tickets.createIndex(
      { assignedPlatformAdminId: 1, status: 1 },
      { name: "assignedPlatformAdminId_1_status_1" }
    );

    const msgs = db.collection("platformsupportmessages");
    await msgs.createIndex({ ticketId: 1, createdAt: 1 }, { name: "ticketId_1_createdAt_1" });

    const atts = db.collection("platformsupportattachments");
    await atts.createIndex({ ticketId: 1, uploadedAt: 1 }, { name: "ticketId_1_uploadedAt_1" });

    const seq = db.collection("platformsupportsequences");
    await seq.createIndex({ key: 1 }, { unique: true, name: "key_1" });

    const enquiries = db.collection("collaborationenquiries");
    await enquiries.createIndex({ createdAt: -1 }, { name: "createdAt_-1" });
    await enquiries.createIndex(
      { businessEmail: 1, createdAt: -1 },
      { name: "businessEmail_1_createdAt_-1" }
    );

    console.log("[platform-support] indexes ensured");
  },

  async down(db) {
    // Additive indexes — leave collections; drop named indexes if present
    for (const [coll, names] of [
      [
        "platformsupporttickets",
        [
          "ticketNumber_1",
          "status_1_createdAt_-1",
          "sourceTenantId_1_createdAt_-1",
          "assignedPlatformAdminId_1_status_1"
        ]
      ],
      ["platformsupportmessages", ["ticketId_1_createdAt_1"]],
      ["platformsupportattachments", ["ticketId_1_uploadedAt_1"]],
      ["platformsupportsequences", ["key_1"]],
      ["collaborationenquiries", ["createdAt_-1", "businessEmail_1_createdAt_-1"]]
    ]) {
      const collection = db.collection(coll);
      const indexes = await collection.indexes().catch(() => []);
      const existing = new Set(indexes.map((i) => i.name));
      for (const name of names) {
        if (existing.has(name)) await collection.dropIndex(name);
      }
    }
  }
};
