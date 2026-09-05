/**
 * Exercises the tenants migration module against the isolated test DB
 * (MongoMemoryServer). Does not require() migrate-mongo (v14 ESM) inside Jest.
 *
 * Changelog / "already applied" behavior is covered by the migrate-mongo CLI
 * (npm run migrate:status | migrate:up) outside Jest.
 */
const { MongoClient } = require("mongodb");
const migration = require("../../migrations/20260905120000-create-tenants-and-seed-elva");

describe("tenants migration module", () => {
  let client;
  let db;

  beforeEach(async () => {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();
  });

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
  });

  test("up creates indexes and seeds ELVA; second up is idempotent", async () => {
    await migration.up(db);

    const tenants = db.collection("tenants");
    const elva = await tenants.findOne({ slug: "elva" });
    expect(elva).toBeTruthy();
    expect(elva.name).toBe("ELVA Technologies");
    expect(elva.status).toBe("ACTIVE");
    expect(elva.settings).toMatchObject({
      organization: {},
      branding: {},
      notifications: {}
    });

    const indexes = await tenants.indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toEqual(expect.arrayContaining(["slug_1", "status_1"]));
    expect(indexes.find((i) => i.name === "slug_1").unique).toBe(true);

    await migration.up(db);
    expect(await tenants.countDocuments({ slug: "elva" })).toBe(1);
  });

  test("down removes ELVA seed and drops migration indexes", async () => {
    await migration.up(db);
    await migration.down(db);

    const tenants = db.collection("tenants");
    expect(await tenants.findOne({ slug: "elva" })).toBeNull();

    const indexes = await tenants.indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).not.toContain("slug_1");
    expect(indexNames).not.toContain("status_1");
  });
});
