require("dotenv").config();
const { MongoClient } = require("mongodb");

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const elva = await db.collection("tenants").findOne({ slug: "elva" });
  const cols = [
    "users",
    "applications",
    "teams",
    "merchantprofiles",
    "tickets",
    "ticketsequences",
    "email_threads",
    "inbound_mail_queue",
    "classification_queue",
    "notificationevents",
    "notificationdeliveries",
    "auditlogs"
  ];
  console.log("ELVA", elva._id.toString());
  for (const col of cols) {
    const total = await db.collection(col).countDocuments();
    const withT = await db.collection(col).countDocuments({ tenantId: elva._id });
    const miss = await db.collection(col).countDocuments({
      $or: [{ tenantId: { $exists: false } }, { tenantId: null }]
    });
    console.log(col, { total, withT, miss });
  }
  const idx = await db.collection("merchantprofiles").indexes();
  console.log(
    "merchant indexes",
    idx.map((i) => i.name + (i.unique ? " unique" : ""))
  );
  const seq = await db.collection("ticketsequences").find().toArray();
  console.log(
    "sequences",
    seq.map((s) => ({
      code: s.applicationCode,
      year: s.year,
      last: s.lastNumber,
      tenant: Boolean(s.tenantId)
    }))
  );
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
