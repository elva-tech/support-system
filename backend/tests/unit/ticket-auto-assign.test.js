const mongoose = require("mongoose");
const { pickAvailableAgent, processQueuedTickets, refreshAgentAvailability } = require("../../src/modules/tickets/ticket-auto-assign.service");
const Ticket = require("../../src/modules/tickets/ticket.model");
const User = require("../../src/modules/users/user.model");
const { TICKET_STATUSES } = require("../../src/shared/constants/ticket-statuses");
const { ROLES } = require("../../src/shared/constants/roles");

describe("ticket auto-assign", () => {
  let teamId;
  let agentEarly;
  let agentLate;

  beforeEach(async () => {
    teamId = new mongoose.Types.ObjectId();

    const base = { teamId, role: ROLES.AGENT, isActive: true, password: "Password@123" };

    agentEarly = await User.create({
      ...base,
      email: `early-${Date.now()}@test.com`,
      firstName: "Early",
      lastName: "Agent",
      availableSince: new Date("2026-01-01T10:00:00Z")
    });

    agentLate = await User.create({
      ...base,
      email: `late-${Date.now()}@test.com`,
      firstName: "Late",
      lastName: "Agent",
      availableSince: new Date("2026-01-01T12:00:00Z")
    });
  });

  it("picks the agent who has been free the longest", async () => {
    const { agent } = await pickAvailableAgent(teamId);
    expect(agent._id.toString()).toBe(agentEarly._id.toString());
  });

  it("assigns queued tickets when an agent becomes free", async () => {
    await Ticket.create({
      ticketNumber: `Q-${Date.now()}`,
      applicationId: new mongoose.Types.ObjectId(),
      applicationCode: "TST",
      moduleId: new mongoose.Types.ObjectId(),
      merchantId: new mongoose.Types.ObjectId(),
      teamId,
      subject: "Queued ticket",
      description: "Waiting in queue",
      status: TICKET_STATUSES.OPEN,
      assignedTo: null
    });

    await Ticket.create({
      ticketNumber: `BUSY-${Date.now()}`,
      applicationId: new mongoose.Types.ObjectId(),
      applicationCode: "TST",
      moduleId: new mongoose.Types.ObjectId(),
      merchantId: new mongoose.Types.ObjectId(),
      teamId,
      subject: "Busy agent ticket",
      description: "Keeps late agent busy",
      status: TICKET_STATUSES.IN_PROGRESS,
      assignedTo: agentLate._id
    });

    const assigned = await processQueuedTickets(teamId);
    expect(assigned).toBe(1);

    const queued = await Ticket.findOne({ subject: "Queued ticket" });
    expect(queued.assignedTo.toString()).toBe(agentEarly._id.toString());
  });

  it("updates availableSince when agent has no active tickets", async () => {
    await refreshAgentAvailability(agentEarly._id);
    const updated = await User.findById(agentEarly._id);
    expect(updated.availableSince).toBeInstanceOf(Date);
  });
});
