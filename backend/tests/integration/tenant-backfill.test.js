/**
 * Phase 3: tenant backfill migrations against isolated MongoMemoryServer.
 * Invokes migration modules directly (migrate-mongo v14 is ESM and not Jest-friendly).
 */
const { MongoClient, ObjectId } = require("mongodb");
const {
  resolveElvaTenantId,
  backfillCollection,
  missingTenantFilter
} = require("../../src/shared/migration/tenant-backfill");
const addIndexesCore = require("../../migrations/20260905130000-add-tenantid-indexes-core");
const backfillCore = require("../../migrations/20260905131000-backfill-elva-tenant-core");
const merchantIndex = require("../../migrations/20260905132000-merchant-email-unique-tenant-scoped");
const sequenceIndex = require("../../migrations/20260905133000-ticket-sequence-tenant-unique");
const backfillOps = require("../../migrations/20260905134000-add-tenantid-and-backfill-operational");
const seedTenants = require("../../migrations/20260905120000-create-tenants-and-seed-elva");

describe("Phase 3 ELVA tenant backfill", () => {
  let client;
  let db;
  let elvaId;

  beforeEach(async () => {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();

    await seedTenants.up(db);
    elvaId = await resolveElvaTenantId(db);

    await db.collection("users").insertOne({
      email: "agent@test.com",
      password: "hash",
      firstName: "A",
      lastName: "B",
      role: "AGENT",
      isActive: true
    });
    await db.collection("applications").insertOne({
      name: "ApnaCart",
      code: "APN",
      isActive: true
    });
    const app = await db.collection("applications").findOne({ code: "APN" });
    await db.collection("teams").insertOne({
      name: "Team A",
      applicationId: app._id,
      isActive: true
    });
    await db.collection("merchantprofiles").insertOne({
      applicationId: app._id,
      applicationCode: "APN",
      externalUserId: "ext-1",
      merchantName: "Merchant One",
      email: "merchant@test.com",
      isActive: true
    });
    // Legacy global email unique (pre-Phase-3)
    await db.collection("merchantprofiles").createIndex({ email: 1 }, { unique: true, name: "email_1" });

    await db.collection("tickets").insertOne({
      ticketNumber: "APN-2026-000001",
      applicationId: app._id,
      applicationCode: "APN",
      moduleId: new ObjectId(),
      merchantId: (await db.collection("merchantprofiles").findOne({}))._id,
      teamId: (await db.collection("teams").findOne({}))._id,
      subject: "Help",
      description: "Desc",
      status: "OPEN"
    });
    await db.collection("ticketsequences").insertOne({
      applicationCode: "APN",
      year: 2026,
      lastNumber: 1
    });
    await db
      .collection("ticketsequences")
      .createIndex({ applicationCode: 1, year: 1 }, { unique: true, name: "applicationCode_1_year_1" });

    await db.collection("email_threads").insertOne({
      ticketId: (await db.collection("tickets").findOne({}))._id,
      messageId: "<msg-1@test>",
      direction: "INBOUND",
      subject: "Hi"
    });
    await db.collection("notificationevents").insertOne({
      eventType: "TICKET_CREATED",
      entityId: new ObjectId(),
      processed: false
    });
    await db.collection("auditlogs").insertOne({
      entityType: "TICKET",
      entityId: new ObjectId(),
      action: "TICKET_CREATED",
      actorType: "SYSTEM",
      actorName: "System"
    });
  });

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
  });

  test("backfills core + operational collections to ELVA and is idempotent", async () => {
    await addIndexesCore.up(db);
    await backfillCore.up(db);
    await backfillOps.up(db);

    for (const name of [
      "users",
      "applications",
      "teams",
      "merchantprofiles",
      "tickets",
      "ticketsequences",
      "email_threads",
      "notificationevents",
      "auditlogs"
    ]) {
      const missing = await db.collection(name).countDocuments(missingTenantFilter);
      expect(missing).toBe(0);
      const withElva = await db.collection(name).countDocuments({ tenantId: elvaId });
      expect(withElva).toBeGreaterThan(0);
    }

    // Idempotency: second backfill updates 0 rows
    const second = await backfillCollection(db, "tickets", elvaId);
    expect(second.updated).toBe(0);
    expect(second.missingAfter).toBe(0);
  });

  test("merchant email unique becomes tenant-scoped; same email allowed across tenants", async () => {
    await addIndexesCore.up(db);
    await backfillCore.up(db);
    await merchantIndex.up(db);

    const indexes = await db.collection("merchantprofiles").indexes();
    expect(indexes.some((i) => i.name === "tenantId_1_email_1" && i.unique)).toBe(true);
    expect(indexes.some((i) => i.name === "email_1")).toBe(false);

    const otherTenantId = new ObjectId();
    await db.collection("tenants").insertOne({
      _id: otherTenantId,
      name: "Other Co",
      slug: "other-co",
      status: "ACTIVE",
      settings: { organization: {}, branding: {}, notifications: {} },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.collection("merchantprofiles").insertOne({
      tenantId: otherTenantId,
      applicationId: new ObjectId(),
      applicationCode: "OTH",
      externalUserId: "ext-other",
      merchantName: "Other Merchant",
      email: "merchant@test.com",
      isActive: true
    });

    const sameEmailCount = await db.collection("merchantprofiles").countDocuments({
      email: "merchant@test.com"
    });
    expect(sameEmailCount).toBe(2);

    // Within ELVA, duplicate email still blocked
    await expect(
      db.collection("merchantprofiles").insertOne({
        tenantId: elvaId,
        applicationId: new ObjectId(),
        applicationCode: "APN",
        externalUserId: "ext-dup",
        merchantName: "Dup",
        email: "merchant@test.com",
        isActive: true
      })
    ).rejects.toThrow();
  });

  test("ticket sequence compound unique exists and legacy unique is preserved", async () => {
    await addIndexesCore.up(db);
    await backfillCore.up(db);
    await sequenceIndex.up(db);

    const indexes = await db.collection("ticketsequences").indexes();
    expect(indexes.some((i) => i.name === "tenantId_1_applicationCode_1_year_1" && i.unique)).toBe(
      true
    );
    expect(indexes.some((i) => i.name === "applicationCode_1_year_1" && i.unique)).toBe(true);

    const seq = await db.collection("ticketsequences").findOne({ applicationCode: "APN", year: 2026 });
    expect(String(seq.tenantId)).toBe(String(elvaId));
    expect(seq.lastNumber).toBe(1);
  });
});
