const fs = require("fs");
const path = require("path");
const ApiError = require("../../shared/utils/ApiError");
const env = require("../../config/env");
const PlatformSupportTicket = require("./platform-support-ticket.model");
const PlatformSupportMessage = require("./platform-support-message.model");
const PlatformSupportAttachment = require("./platform-support-attachment.model");
const PlatformSupportSequence = require("./platform-support-sequence.model");
const CentralSupportUser = require("../central-support/central-support-user.model");
const CentralSupportTeam = require("../central-support/central-support-team.model");
const {
  PLATFORM_SUPPORT_STATUSES,
  PLATFORM_SUPPORT_PRIORITIES,
  PLATFORM_SUPPORT_CATEGORIES,
  PLATFORM_SUPPORT_CATEGORY_LABELS,
  DEFAULT_PLATFORM_SUPPORT_SLA,
  ALL_PLATFORM_SUPPORT_STATUSES,
  ALL_PLATFORM_SUPPORT_PRIORITIES
} = require("../../shared/constants/platform-support");
const { SLA_CLOCK_STATES } = require("../../shared/constants/service-management");
const { addSlaMinutes, elapsedSlaMinutes, percentConsumed } = require("../../shared/utils/business-hours.util");
const { logPlatformAudit } = require("../platform-admin/platform-audit.service");
const {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../../shared/constants/platform");
const {
  CENTRAL_SUPPORT_ROLES,
  CENTRAL_SUPPORT_USER_STATUSES,
  CENTRAL_SUPPORT_ERROR_CODES,
  CENTRAL_SUPPORT_ASSIGNABLE_ROLES
} = require("../../shared/constants/central-support");
const { buildWorkspaceUrl } = require("../tenants/workspace-domain.service");
const { idsEqual } = require("../tenants/tenant-resolver.service");
const notificationManager = require("../notifications/notification-manager.service");
const logger = require("../../shared/utils/logger");

const ROLES_CAN_CREATE = new Set(["ADMIN", "TEAM_LEAD", "AGENT"]);

const platformSm = () => ({
  businessHours: {
    timezone: "Asia/Kolkata",
    startTime: "09:00",
    endTime: "18:00",
    workingDays: [1, 2, 3, 4, 5]
  },
  slaPolicies: DEFAULT_PLATFORM_SUPPORT_SLA
});

const nextTicketNumber = async () => {
  const doc = await PlatformSupportSequence.findOneAndUpdate(
    { key: "ELVA" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `ELVA-${String(doc.seq).padStart(4, "0")}`;
};

const buildSlaCycle = (priority, startedAt = new Date()) => {
  const sm = platformSm();
  const code = ALL_PLATFORM_SUPPORT_PRIORITIES.includes(priority)
    ? priority
    : PLATFORM_SUPPORT_PRIORITIES.MEDIUM;
  const policy =
    sm.slaPolicies.find((p) => p.priority === code) ||
    sm.slaPolicies.find((p) => p.priority === PLATFORM_SUPPORT_PRIORITIES.MEDIUM);
  const responseTarget = policy?.responseTargetMinutes ?? 8 * 60;
  const resolutionTarget = policy?.resolutionTargetMinutes ?? 2 * 24 * 60;
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);

  return {
    cycleNumber: 1,
    priority: code,
    startedAt: start,
    responseTargetMinutes: responseTarget,
    resolutionTargetMinutes: resolutionTarget,
    useBusinessHours: false,
    responseDueAt: addSlaMinutes(start, responseTarget, sm.businessHours, { useBusinessHours: false }),
    resolutionDueAt: addSlaMinutes(start, resolutionTarget, sm.businessHours, {
      useBusinessHours: false
    }),
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    responseState: SLA_CLOCK_STATES.ON_TRACK,
    resolutionState: SLA_CLOCK_STATES.ON_TRACK,
    responseBreachedAt: null,
    resolutionBreachedAt: null,
    triggeredThresholds: [],
    outcome: null
  };
};

const refreshSla = (ticket, now = new Date()) => {
  const cycle = ticket.sla?.currentCycle;
  if (!cycle || cycle.outcome) return ticket;

  const sm = platformSm();
  const elapsedResponse = elapsedSlaMinutes(cycle.startedAt, cycle.firstResponseAt || now, sm.businessHours, {
    useBusinessHours: false
  });
  const elapsedResolution = elapsedSlaMinutes(cycle.startedAt, cycle.resolvedAt || now, sm.businessHours, {
    useBusinessHours: false
  });

  const stateFromPct = (pct, completed) => {
    if (completed) return SLA_CLOCK_STATES.COMPLETED;
    if (pct >= 100) return SLA_CLOCK_STATES.BREACHED;
    if (pct >= 90) return SLA_CLOCK_STATES.AT_RISK;
    if (pct >= 75) return SLA_CLOCK_STATES.WARNING;
    return SLA_CLOCK_STATES.ON_TRACK;
  };

  const responsePct = percentConsumed(elapsedResponse, cycle.responseTargetMinutes);
  const resolutionPct = percentConsumed(elapsedResolution, cycle.resolutionTargetMinutes);
  cycle.responseState = stateFromPct(responsePct, Boolean(cycle.firstResponseAt));
  cycle.resolutionState = stateFromPct(resolutionPct, Boolean(cycle.resolvedAt));
  if (!cycle.firstResponseAt && responsePct >= 100 && !cycle.responseBreachedAt) {
    cycle.responseBreachedAt = now;
  }
  if (!cycle.resolvedAt && resolutionPct >= 100 && !cycle.resolutionBreachedAt) {
    cycle.resolutionBreachedAt = now;
  }
  ticket.sla.currentCycle = cycle;
  return ticket;
};

const organizationNameFromTenant = (tenant) =>
  tenant?.settings?.organization?.displayName ||
  tenant?.settings?.organization?.name ||
  tenant?.name ||
  tenant?.slug;

const toPublicTicket = (doc, { includeSla = true } = {}) => {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  if (includeSla) refreshSla({ sla: o.sla || {} });
  return {
    id: String(o._id),
    ticketNumber: o.ticketNumber,
    status: o.status,
    priority: o.priority,
    category: o.category,
    categoryLabel: PLATFORM_SUPPORT_CATEGORY_LABELS[o.category] || o.category,
    subject: o.subject,
    description: o.description,
    sourceTenantId: String(o.sourceTenantId),
    sourceTenantSlug: o.sourceTenantSlug,
    sourceOrganizationName: o.sourceOrganizationName,
    sourceWorkspaceUrl: o.sourceWorkspaceUrl,
    raisedByUserId: String(o.raisedByUserId),
    raisedByName: o.raisedByName,
    raisedByEmail: o.raisedByEmail,
    raisedByRole: o.raisedByRole,
    assignedUserId: o.assignedCentralSupportUserId
      ? String(o.assignedCentralSupportUserId)
      : null,
    assignedUserName: o.assignedCentralSupportUserName || null,
    assignedTeamId: o.assignedCentralSupportTeamId
      ? String(o.assignedCentralSupportTeamId)
      : null,
    assignedTeamName: o.assignedCentralSupportTeamName || null,
    assignedAt: o.assignedAt,
    sla: o.sla || null,
    resolvedAt: o.resolvedAt,
    closedAt: o.closedAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
};

const assertStaffCanCreate = (user) => {
  if (!user || !ROLES_CAN_CREATE.has(user.role)) {
    throw new ApiError(403, "Only business admins and agents can raise ELVA support tickets");
  }
};

const assertTenantAccess = (ticket, user, tenantId) => {
  if (!idsEqual(ticket.sourceTenantId, tenantId)) {
    throw new ApiError(404, "Support ticket not found");
  }
  if (user.role === "ADMIN") return;
  if (!idsEqual(ticket.raisedByUserId, user._id || user.id)) {
    throw new ApiError(403, "You are not authorized to access this support request");
  }
};

const createTicket = async ({ tenant, user, payload }) => {
  assertStaffCanCreate(user);
  if (!tenant?._id) throw new ApiError(400, "Tenant context is required");

  const category = String(payload.category || "").trim().toUpperCase();
  if (!PLATFORM_SUPPORT_CATEGORIES.includes(category)) {
    throw new ApiError(400, "Invalid support category");
  }
  const subject = String(payload.subject || "").trim();
  const description = String(payload.description || "").trim();
  if (!subject || !description) {
    throw new ApiError(400, "Subject and description are required");
  }

  let priority = String(payload.priority || PLATFORM_SUPPORT_PRIORITIES.MEDIUM).trim().toUpperCase();
  if (priority === "NORMAL") priority = PLATFORM_SUPPORT_PRIORITIES.MEDIUM;
  if (priority === "URGENT") priority = PLATFORM_SUPPORT_PRIORITIES.CRITICAL;
  if (!ALL_PLATFORM_SUPPORT_PRIORITIES.includes(priority)) {
    priority = PLATFORM_SUPPORT_PRIORITIES.MEDIUM;
  }

  const ticketNumber = await nextTicketNumber();
  const raisedByName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Staff user";

  const ticket = await PlatformSupportTicket.create({
    ticketNumber,
    status: PLATFORM_SUPPORT_STATUSES.OPEN,
    priority,
    category,
    subject,
    description,
    sourceTenantId: tenant._id,
    sourceTenantSlug: tenant.slug,
    sourceOrganizationName: organizationNameFromTenant(tenant),
    sourceWorkspaceUrl: buildWorkspaceUrl(tenant.slug),
    raisedByUserId: user._id,
    raisedByName,
    raisedByEmail: user.email,
    raisedByRole: user.role,
    sla: { currentCycle: buildSlaCycle(priority), previousCycles: [] }
  });

  try {
    await notificationManager.sendEmail({
      to: env.email?.supportAddress || "support@elvatech.in",
      subject: `[Platform Support] ${ticketNumber} — ${organizationNameFromTenant(tenant)}`,
      html: `<p>New platform support ticket <strong>${ticketNumber}</strong></p>
        <p><strong>${escapeHtml(subject)}</strong></p>
        <p>From ${escapeHtml(raisedByName)} (${escapeHtml(user.email)}) · ${escapeHtml(user.role)}</p>
        <p>Organization: ${escapeHtml(organizationNameFromTenant(tenant))} (${escapeHtml(tenant.slug)})</p>`
    });
  } catch (err) {
    logger.warn("Platform support notify failed", { error: err.message, ticketNumber });
  }

  await logPlatformAudit({
    action: PLATFORM_AUDIT_ACTIONS.PLATFORM_SUPPORT_TICKET_CREATED,
    actorPlatformAdminId: null,
    actorEmail: user.email || "",
    targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_SUPPORT,
    targetId: ticket._id,
    metadata: {
      ticketNumber,
      raisedByUserId: String(user._id),
      category,
      tenantId: String(tenant._id),
      tenantSlug: tenant.slug
    }
  }).catch(() => undefined);

  return toPublicTicket(ticket);
};

const listForTenantUser = async ({ tenantId, user, filters = {} }) => {
  assertStaffCanCreate(user);
  const query = { sourceTenantId: tenantId };
  if (user.role !== "ADMIN") {
    query.raisedByUserId = user._id;
  }
  if (filters.status && ALL_PLATFORM_SUPPORT_STATUSES.includes(filters.status)) {
    query.status = filters.status;
  }
  if (filters.search) {
    const q = String(filters.search).trim();
    query.$or = [
      { ticketNumber: new RegExp(q, "i") },
      { subject: new RegExp(q, "i") },
      { raisedByEmail: new RegExp(q, "i") }
    ];
  }

  const items = await PlatformSupportTicket.find(query).sort({ createdAt: -1 }).limit(100);
  return items.map((t) => toPublicTicket(t));
};

const getForTenantUser = async ({ tenantId, user, ticketId }) => {
  assertStaffCanCreate(user);
  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  assertTenantAccess(ticket, user, tenantId);
  return toPublicTicket(ticket);
};

const listForCentralSupport = async (filters = {}) => {
  const actor = filters.actor;
  const query = {};
  if (filters.status && ALL_PLATFORM_SUPPORT_STATUSES.includes(filters.status)) {
    query.status = filters.status;
  }
  if (filters.priority && ALL_PLATFORM_SUPPORT_PRIORITIES.includes(filters.priority)) {
    query.priority = filters.priority;
  }
  if (filters.category && PLATFORM_SUPPORT_CATEGORIES.includes(filters.category)) {
    query.category = filters.category;
  }
  if (filters.tenantId) query.sourceTenantId = filters.tenantId;

  if (filters.assignedUserId === "unassigned") {
    query.assignedCentralSupportUserId = null;
  } else if (filters.assignedUserId) {
    query.assignedCentralSupportUserId = filters.assignedUserId;
  }
  if (filters.assignedTeamId) {
    query.assignedCentralSupportTeamId = filters.assignedTeamId;
  }
  if (filters.mine && actor?._id) {
    query.assignedCentralSupportUserId = actor._id;
  }
  if (filters.teamQueue && actor) {
    if (actor.teamId) {
      query.assignedCentralSupportTeamId = actor.teamId;
    } else if (actor.role !== CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN) {
      query.assignedCentralSupportUserId = actor._id;
    }
  }

  // Role scoping when listing "all" without mine/teamQueue
  if (!filters.mine && !filters.teamQueue && actor) {
    if (actor.role === CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_AGENT) {
      query.$or = [
        { assignedCentralSupportUserId: actor._id },
        ...(actor.teamId ? [{ assignedCentralSupportTeamId: actor.teamId }] : [])
      ];
    } else if (actor.role === CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD) {
      query.$or = [
        { assignedCentralSupportUserId: actor._id },
        ...(actor.teamId ? [{ assignedCentralSupportTeamId: actor.teamId }] : []),
        { assignedCentralSupportUserId: null, assignedCentralSupportTeamId: null }
      ];
    }
    // ADMIN: no extra scope
  }

  if (filters.search) {
    const q = String(filters.search).trim();
    const searchOr = [
      { ticketNumber: new RegExp(q, "i") },
      { subject: new RegExp(q, "i") },
      { sourceOrganizationName: new RegExp(q, "i") },
      { raisedByName: new RegExp(q, "i") },
      { raisedByEmail: new RegExp(q, "i") },
      { sourceTenantSlug: new RegExp(q, "i") }
    ];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchOr }];
      delete query.$or;
    } else {
      query.$or = searchOr;
    }
  }

  const limit = Math.min(Number(filters.limit) || 50, 200);
  const skip = Math.max(Number(filters.skip) || 0, 0);
  const [items, total] = await Promise.all([
    PlatformSupportTicket.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PlatformSupportTicket.countDocuments(query)
  ]);
  return { items: items.map((t) => toPublicTicket(t)), total, limit, skip };
};

const assertCentralSupportCanViewTicket = (ticket, actor) => {
  if (!actor) throw new ApiError(401, "Authentication required");
  if (actor.role === CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN) return;
  const assignedToMe = idsEqual(ticket.assignedCentralSupportUserId, actor._id);
  const onMyTeam =
    actor.teamId && idsEqual(ticket.assignedCentralSupportTeamId, actor.teamId);
  const unassigned =
    !ticket.assignedCentralSupportUserId && !ticket.assignedCentralSupportTeamId;

  if (actor.role === CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD) {
    if (assignedToMe || onMyTeam || unassigned) return;
    throw new ApiError(403, "You are not authorized to view this ticket");
  }

  if (assignedToMe || onMyTeam) return;
  throw new ApiError(403, "You are not authorized to view this ticket");
};

const getForCentralSupport = async ({ ticketId, actor }) => {
  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  assertCentralSupportCanViewTicket(ticket, actor);
  return toPublicTicket(ticket);
};

const assignTicket = async ({
  ticketId,
  assignedUserId,
  assignedTeamId,
  unassign = false,
  actor
}) => {
  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");

  if (unassign) {
    ticket.assignedCentralSupportUserId = null;
    ticket.assignedCentralSupportUserName = null;
    ticket.assignedCentralSupportTeamId = null;
    ticket.assignedCentralSupportTeamName = null;
    ticket.assignedAt = null;
    ticket.assignedPlatformAdminId = null;
    ticket.assignedPlatformAdminName = null;
    await ticket.save();
    return toPublicTicket(ticket);
  }

  let user = null;
  let team = null;

  if (assignedUserId) {
    user = await CentralSupportUser.findById(assignedUserId);
    if (
      !user ||
      user.status !== CENTRAL_SUPPORT_USER_STATUSES.ACTIVE ||
      !CENTRAL_SUPPORT_ASSIGNABLE_ROLES.includes(user.role)
    ) {
      throw new ApiError(400, "Assignee must be an active Central Support user", {
        code: CENTRAL_SUPPORT_ERROR_CODES.INVALID_ASSIGNEE
      });
    }

    if (
      actor?.role === CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD &&
      actor.teamId &&
      user.teamId &&
      !idsEqual(user.teamId, actor.teamId) &&
      !idsEqual(user._id, actor._id)
    ) {
      throw new ApiError(403, "Team leads can only assign within their team");
    }
  }

  if (assignedTeamId) {
    team = await CentralSupportTeam.findById(assignedTeamId);
    if (!team || !team.isActive) {
      throw new ApiError(400, "Assigned team not found or inactive", {
        code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_TEAM_NOT_FOUND
      });
    }
    if (
      actor?.role === CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD &&
      actor.teamId &&
      !idsEqual(team._id, actor.teamId)
    ) {
      throw new ApiError(403, "Team leads can only assign to their own team");
    }
  } else if (user?.teamId) {
    team = await CentralSupportTeam.findById(user.teamId);
  }

  if (!user && !team) {
    throw new ApiError(400, "Provide assignedUserId and/or assignedTeamId, or set unassign=true");
  }

  if (user) {
    ticket.assignedCentralSupportUserId = user._id;
    ticket.assignedCentralSupportUserName = user.name;
  }

  if (team) {
    ticket.assignedCentralSupportTeamId = team._id;
    ticket.assignedCentralSupportTeamName = team.name;
  }

  ticket.assignedAt = new Date();
  ticket.assignedPlatformAdminId = null;
  ticket.assignedPlatformAdminName = null;

  if (ticket.status === PLATFORM_SUPPORT_STATUSES.OPEN) {
    ticket.status = PLATFORM_SUPPORT_STATUSES.IN_PROGRESS;
  }
  await ticket.save();

  await logPlatformAudit({
    action: PLATFORM_AUDIT_ACTIONS.PLATFORM_SUPPORT_TICKET_ASSIGNED,
    actorPlatformAdminId: null,
    actorEmail: actor?.email || "",
    targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_SUPPORT,
    targetId: ticket._id,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      assignedUserId: user ? String(user._id) : null,
      assignedTeamId: team ? String(team._id) : null,
      tenantId: String(ticket.sourceTenantId),
      actorKind: "CENTRAL_SUPPORT"
    }
  }).catch(() => undefined);

  return toPublicTicket(ticket);
};

/** @deprecated Platform admin ops removed — kept name alias for any leftover imports */
const listForPlatform = listForCentralSupport;
const getForPlatform = async (ticketId) => {
  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  return toPublicTicket(ticket);
};

const updateStatus = async ({ ticketId, status, actor, actorKind = "CENTRAL_SUPPORT" }) => {
  if (!ALL_PLATFORM_SUPPORT_STATUSES.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }
  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");

  const prev = ticket.status;
  ticket.status = status;
  const now = new Date();
  if (status === PLATFORM_SUPPORT_STATUSES.RESOLVED) {
    ticket.resolvedAt = now;
    if (ticket.sla?.currentCycle) {
      ticket.sla.currentCycle.resolvedAt = now;
      ticket.sla.currentCycle.outcome = "RESOLVED";
    }
  }
  if (status === PLATFORM_SUPPORT_STATUSES.CLOSED) {
    ticket.closedAt = now;
    if (ticket.sla?.currentCycle) {
      ticket.sla.currentCycle.closedAt = now;
      ticket.sla.currentCycle.outcome = ticket.sla.currentCycle.outcome || "CLOSED";
    }
  }
  if (
    (prev === PLATFORM_SUPPORT_STATUSES.RESOLVED || prev === PLATFORM_SUPPORT_STATUSES.CLOSED) &&
    status === PLATFORM_SUPPORT_STATUSES.OPEN
  ) {
    ticket.resolvedAt = null;
    ticket.closedAt = null;
    const previous = ticket.sla?.currentCycle;
    if (previous) {
      ticket.sla.previousCycles = [...(ticket.sla.previousCycles || []), previous];
    }
    ticket.sla.currentCycle = buildSlaCycle(ticket.priority);
  }

  ticket.markModified("sla");
  await ticket.save();

  await logPlatformAudit({
    action: PLATFORM_AUDIT_ACTIONS.PLATFORM_SUPPORT_TICKET_STATUS_CHANGED,
    actorPlatformAdminId: actorKind === "PLATFORM" ? actor?._id : null,
    actorEmail: actor?.email || "",
    targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_SUPPORT,
    targetId: ticket._id,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      from: prev,
      to: status,
      tenantId: String(ticket.sourceTenantId),
      actorKind: actorKind || "CENTRAL_SUPPORT"
    }
  }).catch(() => undefined);

  return toPublicTicket(ticket);
};

const addMessage = async ({
  ticketId,
  message,
  actor,
  senderType,
  internal = false,
  tenantUser = null,
  tenantId = null
}) => {
  const text = String(message || "").trim();
  if (!text) throw new ApiError(400, "Message is required");

  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");

  if (senderType === "TENANT_USER") {
    assertTenantAccess(ticket, tenantUser, tenantId);
  }

  const senderName =
    senderType === "CENTRAL_SUPPORT" || senderType === "PLATFORM_ADMIN"
      ? actor?.name || "ELVA Support"
      : [tenantUser?.firstName, tenantUser?.lastName].filter(Boolean).join(" ").trim() ||
        tenantUser?.email ||
        "Staff user";

  const msg = await PlatformSupportMessage.create({
    ticketId: ticket._id,
    type: internal ? "INTERNAL_NOTE" : "MESSAGE",
    senderType,
    senderId: actor?._id || tenantUser?._id || null,
    senderName,
    message: text
  });

  if (
    (senderType === "CENTRAL_SUPPORT" || senderType === "PLATFORM_ADMIN") &&
    !internal &&
    ticket.sla?.currentCycle &&
    !ticket.sla.currentCycle.firstResponseAt
  ) {
    ticket.sla.currentCycle.firstResponseAt = new Date();
    ticket.markModified("sla");
    if (ticket.status === PLATFORM_SUPPORT_STATUSES.OPEN) {
      ticket.status = PLATFORM_SUPPORT_STATUSES.IN_PROGRESS;
    }
    await ticket.save();
  }

  return {
    id: String(msg._id),
    ticketId: String(msg.ticketId),
    type: msg.type,
    senderType: msg.senderType,
    senderName: msg.senderName,
    message: msg.message,
    createdAt: msg.createdAt
  };
};

const getTimeline = async ({
  ticketId,
  includeInternal = false,
  tenantUser = null,
  tenantId = null,
  downloadBase = null
}) => {
  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  if (tenantUser) assertTenantAccess(ticket, tenantUser, tenantId);

  const msgQuery = { ticketId: ticket._id };
  if (!includeInternal) msgQuery.type = "MESSAGE";

  const [messages, attachments] = await Promise.all([
    PlatformSupportMessage.find(msgQuery).sort({ createdAt: 1 }),
    PlatformSupportAttachment.find({ ticketId: ticket._id }).sort({ uploadedAt: 1 })
  ]);

  const base =
    downloadBase ||
    (tenantUser ? "/api/platform-support/tickets" : "/api/central-support/tickets");

  const initial = {
    id: `initial-${ticket._id}`,
    ticketId: String(ticket._id),
    type: "MESSAGE",
    senderType: "TENANT_USER",
    senderName: ticket.raisedByName,
    message: ticket.description,
    createdAt: ticket.createdAt,
    isInitial: true
  };

  return {
    ticket: toPublicTicket(ticket),
    timeline: [
      initial,
      ...messages.map((m) => ({
        id: String(m._id),
        ticketId: String(m.ticketId),
        type: m.type,
        senderType: m.senderType,
        senderName: m.senderName,
        message: m.message,
        createdAt: m.createdAt
      })),
      ...attachments.map((a) => ({
        id: String(a._id),
        ticketId: String(a.ticketId),
        type: "ATTACHMENT",
        senderType: a.uploadedBy.startsWith("central:")
          ? "CENTRAL_SUPPORT"
          : a.uploadedBy.startsWith("platform:")
            ? "PLATFORM_ADMIN"
            : "TENANT_USER",
        senderName: a.uploadedBy.replace(/^(platform|tenant|central):/, ""),
        message: `Uploaded file: ${a.fileName}`,
        createdAt: a.uploadedAt,
        attachment: mapAttachment(a, base)
      }))
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  };
};

const mapAttachment = (a, downloadBase = "/api/platform-support/tickets") => ({
  id: String(a._id),
  fileName: a.fileName,
  mimeType: a.mimeType,
  fileSize: a.fileSize,
  uploadedAt: a.uploadedAt,
  downloadUrl: `${downloadBase}/${a.ticketId}/attachments/${a._id}/download`
});

const uploadAttachment = async ({
  ticketId,
  file,
  uploadedByLabel,
  tenantUser = null,
  tenantId = null,
  platformAdmin = null,
  centralSupportUser = null
}) => {
  if (!file) throw new ApiError(400, "File is required");
  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  if (tenantUser) assertTenantAccess(ticket, tenantUser, tenantId);

  const dir = path.join(env.uploadsDir, "platform-support", ticket.ticketNumber);
  fs.mkdirSync(dir, { recursive: true });
  const safeName = String(file.originalname || "file").replace(/[^\w.\-]+/g, "_");
  const storagePath = path.join(dir, `${Date.now()}-${safeName}`);
  fs.writeFileSync(storagePath, file.buffer);

  let uploadedBy = `tenant:${uploadedByLabel || tenantUser?.email || "user"}`;
  if (centralSupportUser) {
    uploadedBy = `central:${centralSupportUser.name || centralSupportUser.email}`;
  } else if (platformAdmin) {
    uploadedBy = `platform:${platformAdmin.name || platformAdmin.email}`;
  }

  const attachment = await PlatformSupportAttachment.create({
    ticketId: ticket._id,
    fileName: safeName,
    mimeType: file.mimetype,
    fileSize: file.size,
    storagePath,
    uploadedBy
  });

  const downloadBase = centralSupportUser
    ? "/api/central-support/tickets"
    : platformAdmin
      ? "/api/platform/support-tickets"
      : "/api/platform-support/tickets";
  return mapAttachment(attachment, downloadBase);
};

const getAttachmentForDownload = async ({
  ticketId,
  attachmentId,
  tenantUser = null,
  tenantId = null,
  platformAdmin = null,
  centralSupportUser = null
}) => {
  const ticket = await PlatformSupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  if (tenantUser) assertTenantAccess(ticket, tenantUser, tenantId);
  if (!tenantUser && !platformAdmin && !centralSupportUser) {
    throw new ApiError(403, "Unauthorized");
  }

  const attachment = await PlatformSupportAttachment.findOne({
    _id: attachmentId,
    ticketId: ticket._id
  });
  if (!attachment) throw new ApiError(404, "Attachment not found");
  if (!fs.existsSync(attachment.storagePath)) {
    throw new ApiError(404, "Attachment file missing");
  }
  return attachment;
};

const getCreateContext = async ({ tenant, user }) => {
  assertStaffCanCreate(user);
  return {
    organizationName: organizationNameFromTenant(tenant),
    workspace: buildWorkspaceUrl(tenant.slug),
    workspaceSlug: tenant.slug,
    raisedByName:
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email,
    email: user.email,
    role: user.role,
    categories: PLATFORM_SUPPORT_CATEGORIES.map((code) => ({
      code,
      label: PLATFORM_SUPPORT_CATEGORY_LABELS[code]
    })),
    priorities: ALL_PLATFORM_SUPPORT_PRIORITIES
  };
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

module.exports = {
  createTicket,
  listForTenantUser,
  getForTenantUser,
  listForCentralSupport,
  getForCentralSupport,
  listForPlatform,
  getForPlatform,
  assignTicket,
  updateStatus,
  addMessage,
  getTimeline,
  uploadAttachment,
  getAttachmentForDownload,
  getCreateContext,
  toPublicTicket,
  PLATFORM_SUPPORT_CATEGORY_LABELS
};
