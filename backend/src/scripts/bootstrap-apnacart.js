require("dotenv").config();

const { connectDatabase } = require("../config/database");
const { ensureAdminAccount } = require("../bootstrap/ensure-admin");
const Application = require("../modules/applications/application.model");
const Module = require("../modules/modules/module.model");
const Team = require("../modules/teams/team.model");
const userService = require("../modules/users/user.service");
const merchantService = require("../modules/merchants/merchant.service");
const { ROLES } = require("../shared/constants/roles");

/**
 * Restores the ApnaCart demo setup in the current MongoDB database.
 * Safe to re-run — skips records that already exist.
 *
 * Env overrides (optional):
 *   BOOTSTRAP_TEAM_LEAD_EMAIL, BOOTSTRAP_TEAM_LEAD_PASSWORD
 *   BOOTSTRAP_AGENT_EMAIL, BOOTSTRAP_AGENT_PASSWORD
 *   BOOTSTRAP_MERCHANT_EMAIL
 */
const bootstrapApnaCart = async () => {
  await connectDatabase();
  await ensureAdminAccount();

  let application = await Application.findOne({ code: "APN" });
  if (!application) {
    application = await Application.create({
      name: "ApnaCart",
      code: "APN",
      description: "ApnaCart marketplace",
      isActive: true
    });
    console.log("Created application: ApnaCart (APN)");
  } else {
    console.log("Application already exists: ApnaCart (APN)");
  }

  const moduleDefs = [
    { name: "Orders", code: "ORD", description: "Order issues" },
    { name: "Payments", code: "PAY", description: "Payment issues" },
    { name: "Other", code: "OTH", description: "General queries" }
  ];

  for (const def of moduleDefs) {
    const existing = await Module.findOne({ applicationId: application._id, code: def.code });
    if (!existing) {
      await Module.create({ ...def, applicationId: application._id, isActive: true });
      console.log(`Created module: ${def.name}`);
    }
  }

  let team = await Team.findOne({ applicationId: application._id, name: "ApnaCart Support Team" });
  if (!team) {
    team = await Team.create({
      name: "ApnaCart Support Team",
      description: "ApnaCart customer support",
      applicationId: application._id,
      moduleIds: [],
      isActive: true
    });
    console.log("Created team: ApnaCart Support Team");
  } else {
    console.log("Team already exists: ApnaCart Support Team");
  }

  const teamLeadEmail = (process.env.BOOTSTRAP_TEAM_LEAD_EMAIL || "arunpn1999@gmail.com").toLowerCase();
  const teamLeadPassword = process.env.BOOTSTRAP_TEAM_LEAD_PASSWORD || "Arunpn@00";
  const agentEmail = (process.env.BOOTSTRAP_AGENT_EMAIL || "agent@apnacart.support").toLowerCase();
  const agentPassword = process.env.BOOTSTRAP_AGENT_PASSWORD || "Agent@12345";
  const merchantEmail = (process.env.BOOTSTRAP_MERCHANT_EMAIL || "arunpn866@gmail.com").toLowerCase();

  const upsertStaff = async ({ email, password, firstName, lastName, role }) => {
    const existing = await require("../modules/users/user.model").findOne({ email });
    if (existing) {
      await userService.update(existing._id, {
        firstName,
        lastName,
        role,
        teamId: team._id,
        isActive: true,
        ...(password ? { password } : {})
      });
      console.log(`${role} updated: ${email}`);
      return existing;
    }

    const user = await userService.create({
      email,
      password,
      firstName,
      lastName,
      role,
      teamId: team._id,
      isActive: true
    });
    console.log(`Created ${role}: ${email}`);
    return user;
  };

  const teamLead = await upsertStaff({
    email: teamLeadEmail,
    password: teamLeadPassword,
    firstName: "Arun",
    lastName: "Team Lead",
    role: ROLES.TEAM_LEAD
  });

  await upsertStaff({
    email: agentEmail,
    password: agentPassword,
    firstName: "Support",
    lastName: "Agent",
    role: ROLES.AGENT
  });

  const existingMerchant = await require("../modules/merchants/merchant-profile.model").findOne({
    email: merchantEmail
  });

  if (!existingMerchant) {
    await merchantService.createByAdmin({
      applicationId: application._id,
      email: merchantEmail,
      merchantName: "Arun P N",
      isActive: true
    });
    console.log(`Registered merchant: ${merchantEmail}`);
  } else {
    console.log(`Merchant already exists: ${merchantEmail}`);
  }

  console.log("\nBootstrap complete.");
  console.log("Staff login:  http://localhost:4200/auth/login");
  console.log(`  Team lead:  ${teamLeadEmail} / ${teamLeadPassword}`);
  console.log(`  Agent:      ${agentEmail} / ${agentPassword}`);
  console.log("Merchant OTP: http://localhost:4200/merchant/login");
  console.log(`  Merchant:   ${merchantEmail}`);
  process.exit(0);
};

bootstrapApnaCart().catch((error) => {
  console.error("Bootstrap failed:", error.message);
  process.exit(1);
});
