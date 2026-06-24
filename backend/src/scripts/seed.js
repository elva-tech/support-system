require("dotenv").config();

const { connectDatabase } = require("../config/database");
const env = require("../config/env");
const User = require("../modules/users/user.model");
const Application = require("../modules/applications/application.model");
const Team = require("../modules/teams/team.model");
const Module = require("../modules/modules/module.model");
const merchantService = require("../modules/merchants/merchant.service");
const { ROLES } = require("../shared/constants/roles");

const APPLICATIONS = [
  { name: "ApnaCart", code: "APN", description: "ApnaCart merchant platform" },
  { name: "Nano", code: "NAN", description: "Nano application" },
  { name: "Notify", code: "NTF", description: "Notification platform" },
  { name: "Link", code: "LNK", description: "Link management platform" }
];

const seedAdmin = async () => {
  const existing = await User.findOne({ email: env.admin.email });

  if (existing) {
    console.log(`Admin user already exists: ${env.admin.email}`);
    return;
  }

  await User.create({
    email: env.admin.email,
    password: env.admin.password,
    firstName: env.admin.firstName,
    lastName: env.admin.lastName,
    role: ROLES.ADMIN,
    isActive: true
  });

  console.log("Admin user created");
  console.log(`  Email: ${env.admin.email}`);
};

const seedApplications = async () => {
  for (const app of APPLICATIONS) {
    await Application.findOneAndUpdate(
      { code: app.code },
      { ...app, isActive: true },
      { upsert: true, new: true }
    );
    console.log(`Application seeded: ${app.code} — ${app.name}`);
  }
};

const seedApnaCartMerchant = async () => {
  const merchant = await merchantService.syncMerchant({
    applicationCode: "APN",
    externalUserId: "apnacart-demo-001",
    merchantName: "ApnaCart Demo Store",
    email: process.env.SEED_MERCHANT_EMAIL || "merchant@apnacart.demo",
    phone: "+919876543210",
    isActive: true
  });

  console.log("ApnaCart merchant synced");
  console.log(`  Name: ${merchant.merchantName}`);
  console.log(`  Email: ${merchant.email}`);
  console.log(`  Application: ${merchant.applicationCode}`);
};

const seedApnaCartTicketRouting = async () => {
  const application = await Application.findOne({ code: "APN" });
  if (!application) return;

  const team = await Team.findOneAndUpdate(
    { applicationId: application._id, name: "ApnaCart Support" },
    {
      name: "ApnaCart Support",
      description: "Default support team for ApnaCart merchants",
      applicationId: application._id,
      isActive: true
    },
    { upsert: true, new: true }
  );

  await Module.findOneAndUpdate(
    { applicationId: application._id, code: "ORDERS" },
    {
      name: "Orders",
      code: "ORDERS",
      applicationId: application._id,
      description: "Order-related support issues",
      defaultTeamId: team._id,
      isActive: true
    },
    { upsert: true, new: true }
  );

  console.log("ApnaCart ticket routing seeded");
  console.log(`  Team: ${team.name}`);
  console.log("  Module: ORDERS → default team assigned");

  return team;
};

const seedSupportTeamUsers = async (team) => {
  const application = await Application.findOne({ code: "APN" });
  if (!application || !team) return;

  const users = [
    {
      email: process.env.SEED_TEAM_LEAD_EMAIL || "lead@apnacart.support",
      password: process.env.SEED_TEAM_LEAD_PASSWORD || "Lead@12345",
      firstName: "Priya",
      lastName: "Sharma",
      role: ROLES.TEAM_LEAD
    },
    {
      email: process.env.SEED_AGENT_EMAIL || "agent@apnacart.support",
      password: process.env.SEED_AGENT_PASSWORD || "Agent@12345",
      firstName: "Rahul",
      lastName: "Verma",
      role: ROLES.AGENT
    },
    {
      email: process.env.SEED_AGENT2_EMAIL || "agent2@apnacart.support",
      password: process.env.SEED_AGENT2_PASSWORD || "Agent@12345",
      firstName: "Anita",
      lastName: "Desai",
      role: ROLES.AGENT
    }
  ];

  const memberIds = [];

  for (const userData of users) {
    let user = await User.findOne({ email: userData.email });

    if (user) {
      user.firstName = userData.firstName;
      user.lastName = userData.lastName;
      user.role = userData.role;
      user.teamId = team._id;
      user.applicationIds = [application._id];
      user.isActive = true;
      user.password = userData.password;
      await user.save();
    } else {
      user = await User.create({
        ...userData,
        teamId: team._id,
        applicationIds: [application._id],
        isActive: true
      });
    }

    memberIds.push(user._id);
    console.log(`Support user seeded: ${userData.email} (${userData.role})`);
  }

  const teamLead = await User.findOne({ email: users[0].email });
  await Team.findByIdAndUpdate(team._id, {
    teamLeadId: teamLead._id,
    memberIds
  });
};

const seed = async () => {
  await connectDatabase();

  await seedAdmin();
  await seedApplications();
  await seedApnaCartMerchant();
  const team = await seedApnaCartTicketRouting();
  await seedSupportTeamUsers(team);

  console.log("\nSeed complete.");
  console.log("Team Lead: lead@apnacart.support / Lead@12345");
  console.log("Agent: agent@apnacart.support / Agent@12345");
  process.exit(0);
};

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
