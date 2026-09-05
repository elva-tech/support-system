const asyncHandler = require("../../shared/utils/asyncHandler");
const conversationService = require("../conversations/conversation.service");
const { mapAttachmentForClient } = require("../attachments/attachment.service");
const { SENDER_TYPES } = require("../../shared/constants/conversation-types");

const reply = asyncHandler(async (req, res) => {
  const agent = req.user;
  const conversation = await conversationService.addReply(req.params.id, {
    senderType: SENDER_TYPES.AGENT,
    senderId: agent._id,
    senderName: `${agent.firstName} ${agent.lastName}`,
    message: req.body.message
  });

  res.status(201).json({ message: "Reply sent", data: conversation });
});

const internalNote = asyncHandler(async (req, res) => {
  const agent = req.user;
  const conversation = await conversationService.addInternalNote(req.params.id, {
    senderId: agent._id,
    senderName: `${agent.firstName} ${agent.lastName}`,
    message: req.body.message
  });

  res.status(201).json({ message: "Internal note added", data: conversation });
});

const updateStatus = asyncHandler(async (req, res) => {
  const ticket = await conversationService.updateStatus(req.params.id, req.body.status, req.user, {
    closureNotes: req.body.closureNotes,
    tenantId: req.tenant._id
  });
  res.json({ message: "Status updated", data: ticket });
});

const resolveTicket = asyncHandler(async (req, res) => {
  const lifecycle = require("./ticket-lifecycle.service");
  const ticket = await lifecycle.resolveTicket(req.params.id, req.user, {
    tenantId: req.tenant._id,
    notes: req.body.notes || req.body.closureNotes
  });
  res.json({ message: "Ticket resolved", data: ticket });
});

const updatePriority = asyncHandler(async (req, res) => {
  const Ticket = require("./ticket.model");
  const ApiError = require("../../shared/utils/ApiError");
  const slaService = require("./sla.service");
  const { logAudit } = require("../audit/audit.service");
  const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
  const { idsEqual } = require("../tenants/tenant-resolver.service");
  const ticketService = require("./ticket.service");

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket || (req.tenant && ticket.tenantId && !idsEqual(ticket.tenantId, req.tenant._id))) {
    throw new ApiError(404, "Ticket not found");
  }

  const sm = await slaService.getServiceManagement(ticket.tenantId);
  const priority = String(req.body.priority || "").toUpperCase();
  const cfg = (sm.priorities || []).find((p) => p.code === priority && p.enabled !== false);
  if (!cfg) {
    throw new ApiError(400, "Invalid or disabled priority");
  }

  const previous = ticket.priority;
  if (previous === priority) {
    return res.json({ message: "Priority unchanged", data: await ticketService.getById(ticket._id, { tenantId: req.tenant._id }) });
  }

  ticket.priority = priority;
  if (ticket.sla?.currentCycle && !ticket.sla.currentCycle.resolvedAt) {
    const cycle = slaService.buildSlaCycle(
      sm,
      priority,
      ticket.sla.currentCycle.startedAt || new Date(),
      ticket.sla.currentCycle.cycleNumber || 1
    );
    cycle.firstResponseAt = ticket.sla.currentCycle.firstResponseAt;
    cycle.triggeredThresholds = ticket.sla.currentCycle.triggeredThresholds || [];
    ticket.sla.currentCycle = cycle;
    ticket.markModified("sla");
  }
  await ticket.save();

  const agent = req.user;
  const agentName = `${agent.firstName} ${agent.lastName}`;
  const conversationService = require("../conversations/conversation.service");
  await conversationService.addSystemEvent(
    ticket._id,
    `Priority changed from ${previous} to ${priority} by ${agentName}`
  );
  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_PRIORITY_CHANGED,
    actorType: ACTOR_TYPES.AGENT,
    actorId: agent._id,
    actorName: agentName,
    tenantId: ticket.tenantId || null,
    metadata: { ticketNumber: ticket.ticketNumber, previousPriority: previous, priority }
  });

  res.json({
    message: "Priority updated",
    data: await ticketService.getById(ticket._id, { tenantId: req.tenant._id })
  });
});

const getSlaStatus = asyncHandler(async (req, res) => {
  const ticketService = require("./ticket.service");
  const ticket = await ticketService.getById(req.params.id, { tenantId: req.tenant._id });
  res.json({ data: ticket.slaStatus || { hasSla: false } });
});

const transfer = asyncHandler(async (req, res) => {
  const ticket = await conversationService.transferTicket(req.params.id, req.body.teamId, req.user, {
    tenantId: req.tenant._id
  });
  res.json({ message: "Ticket transferred", data: ticket });
});

const timeline = asyncHandler(async (req, res) => {
  const result = await conversationService.getTimeline(req.params.id, { includeInternalNotes: true });
  res.json({ data: result.timeline });
});

const upload = asyncHandler(async (req, res) => {
  const agent = req.user;
  const attachment = await conversationService.uploadAttachment(
    req.params.id,
    req.file,
    `agent:${agent.firstName} ${agent.lastName}`,
    req.body.conversationId || null
  );

  res.status(201).json({ message: "Attachment uploaded", data: mapAttachmentForClient(attachment) });
});

module.exports = {
  reply,
  internalNote,
  updateStatus,
  resolveTicket,
  updatePriority,
  getSlaStatus,
  transfer,
  timeline,
  upload
};
