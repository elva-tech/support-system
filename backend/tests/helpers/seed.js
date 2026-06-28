const Application = require("../../src/modules/applications/application.model");
const Team = require("../../src/modules/teams/team.model");
const Module = require("../../src/modules/modules/module.model");
const User = require("../../src/modules/users/user.model");
const MerchantProfile = require("../../src/modules/merchants/merchant-profile.model");
const Ticket = require("../../src/modules/tickets/ticket.model");
const Attachment = require("../../src/modules/attachments/attachment.model");
const ApplicationProfile = require("../../src/modules/classification/application-profile.model");
const merchantService = require("../../src/modules/merchants/merchant.service");
const { ROLES } = require("../../src/shared/constants/roles");
const { TICKET_STATUSES } = require("../../src/shared/constants/ticket-statuses");
const fs = require("fs");
const path = require("path");
const env = require("../../src/config/env");

const seedTestData = async () => {
  const application = await Application.create({
    name: "ApnaCart",
    code: "APN",
    description: "Test application",
    isActive: true
  });

  const teamA = await Team.create({
    name: "Team A",
    description: "Team A",
    applicationId: application._id,
    isActive: true
  });

  const teamB = await Team.create({
    name: "Team B",
    description: "Team B",
    applicationId: application._id,
    isActive: true
  });

  const moduleDoc = await Module.create({
    name: "Orders",
    code: "ORDERS",
    applicationId: application._id,
    defaultTeamId: teamA._id,
    description: "Orders module",
    isActive: true
  });

  const admin = await User.create({
    email: "admin@test.com",
    password: "Admin@12345",
    firstName: "Admin",
    lastName: "User",
    role: ROLES.ADMIN,
    isActive: true
  });

  const agentA = await User.create({
    email: "agent-a@test.com",
    password: "Agent@12345",
    firstName: "Agent",
    lastName: "A",
    role: ROLES.AGENT,
    teamId: teamA._id,
    applicationIds: [application._id],
    isActive: true
  });

  const agentB = await User.create({
    email: "agent-b@test.com",
    password: "Agent@12345",
    firstName: "Agent",
    lastName: "B",
    role: ROLES.AGENT,
    teamId: teamB._id,
    applicationIds: [application._id],
    isActive: true
  });

  const teamLeadA = await User.create({
    email: "lead-a@test.com",
    password: "Lead@12345",
    firstName: "Lead",
    lastName: "A",
    role: ROLES.TEAM_LEAD,
    teamId: teamA._id,
    applicationIds: [application._id],
    isActive: true
  });

  const merchant = await merchantService.syncMerchant({
    applicationCode: "APN",
    externalUserId: "merchant-test-001",
    merchantName: "Test Merchant",
    email: "merchant@test.com",
    phone: "+919999999999",
    isActive: true
  });

  await ApplicationProfile.create({
    applicationId: application._id,
    keywords: ["apnacart", "merchant", "order", "apn"],
    modules: [
      {
        moduleId: moduleDoc._id,
        keywords: ["order", "delivery", "shipment", "refund", "dispatch"]
      }
    ],
    confidenceThreshold: 0.55
  });

  const ticketA = await Ticket.create({
    ticketNumber: "APN-2026-900001",
    applicationId: application._id,
    applicationCode: "APN",
    moduleId: moduleDoc._id,
    merchantId: merchant._id,
    teamId: teamA._id,
    subject: "Team A ticket",
    description: "Ticket for team A",
    status: TICKET_STATUSES.OPEN
  });

  const ticketB = await Ticket.create({
    ticketNumber: "APN-2026-900002",
    applicationId: application._id,
    applicationCode: "APN",
    moduleId: moduleDoc._id,
    merchantId: merchant._id,
    teamId: teamB._id,
    subject: "Team B ticket",
    description: "Ticket for team B",
    status: TICKET_STATUSES.OPEN
  });

  const uploadsDir = path.join(env.uploadsDir, ticketA.ticketNumber);
  fs.mkdirSync(uploadsDir, { recursive: true });
  const fileName = "test-file.txt";
  fs.writeFileSync(path.join(uploadsDir, fileName), "test attachment content");

  const attachment = await Attachment.create({
    ticketId: ticketA._id,
    fileName,
    mimeType: "text/plain",
    fileSize: 24,
    driveFileId: "mock-file-test",
    driveUrl: "secure-storage",
    uploadedBy: "agent:Agent A",
    uploadedAt: new Date()
  });

  return {
    application,
    teamA,
    teamB,
    moduleDoc,
    admin,
    agentA,
    agentB,
    teamLeadA,
    merchant,
    ticketA,
    ticketB,
    attachment
  };
};

const request = require("supertest");

const loginAgent = async (app, email, password) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data.token;
};

module.exports = { seedTestData, loginAgent };
