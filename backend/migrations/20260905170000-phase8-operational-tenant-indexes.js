/**
 * Phase 8: inbound mail routing indexes + classification queue tenant indexes.
 * Safe / idempotent for existing ELVA data (no destructive backfill).
 */

const ensureIndex = async (collection, keys, options = {}) => {
  const name = options.name;
  const indexes = await collection.indexes().catch(() => []);
  if (name && indexes.some((idx) => idx.name === name)) {
    return;
  }
  await collection.createIndex(keys, options);
};

module.exports = {
  async up(db) {
    const inbound = db.collection("inbound_mail_queue");
    await ensureIndex(inbound, { routingStatus: 1, createdAt: -1 }, {
      name: "routingStatus_1_createdAt_-1"
    });
    await ensureIndex(inbound, { tenantId: 1, status: 1, createdAt: -1 }, {
      name: "tenantId_1_status_1_createdAt_-1"
    });

    const classification = db.collection("classification_queue");
    await ensureIndex(classification, { tenantId: 1, status: 1, createdAt: -1 }, {
      name: "tenantId_1_status_1_createdAt_-1"
    });

    const emailThreads = db.collection("email_threads");
    await ensureIndex(emailThreads, { tenantId: 1, messageId: 1 }, {
      name: "tenantId_1_messageId_1"
    });
    await ensureIndex(emailThreads, { tenantId: 1, ticketId: 1, createdAt: -1 }, {
      name: "tenantId_1_ticketId_1_createdAt_-1"
    });

    console.log("[phase-8] operational tenant routing indexes ensured");
  },

  async down(db) {
    const dropIfExists = async (collectionName, indexName) => {
      const collection = db.collection(collectionName);
      const indexes = await collection.indexes().catch(() => []);
      if (indexes.some((idx) => idx.name === indexName)) {
        await collection.dropIndex(indexName);
      }
    };

    await dropIfExists("inbound_mail_queue", "routingStatus_1_createdAt_-1");
    await dropIfExists("inbound_mail_queue", "tenantId_1_status_1_createdAt_-1");
    await dropIfExists("classification_queue", "tenantId_1_status_1_createdAt_-1");
    await dropIfExists("email_threads", "tenantId_1_messageId_1");
    await dropIfExists("email_threads", "tenantId_1_ticketId_1_createdAt_-1");
  }
};
