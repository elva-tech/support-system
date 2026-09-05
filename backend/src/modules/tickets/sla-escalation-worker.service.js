/**
 * SLA percentage-based escalation worker.
 * Reuses the same poll-interval pattern as notification/email workers.
 * Idempotent via triggeredThresholds on the active SLA cycle.
 *
 * Decision: WAITING_FOR_CUSTOMER does NOT pause the SLA clock in this release
 * (documented in master-domain-sla-ticket-lifecycle.md) to avoid inaccurate
 * pause accounting without durable pause intervals.
 */

const Ticket = require("./ticket.model");
const User = require("../users/user.model");
const Team = require("../teams/team.model");
const { ACTIVE_TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");
const {
  getServiceManagement,
  refreshCycleStates,
  SLA_METRIC_TYPES
} = require("./sla.service");
const {
  ESCALATION_ACTIONS
} = require("../../shared/constants/service-management");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const notificationManager = require("../notifications/notification-manager.service");
const { isTenantOperable, loadTenantById } = require("../../shared/utils/tenant-ops.util");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const { ROLES } = require("../../shared/constants/roles");

const DEFAULT_INTERVAL_MS = 60 * 1000;

let timer = null;
let running = false;

const thresholdKey = (metric, percent) => `${metric}:${percent}`;

const notifyEmail = async (to, subject, body) => {
  if (!to) return;
  await notificationManager.sendEmail({
    to,
    subject,
    html: `<p>${body}</p>`
  });
};

const resolveRecipients = async (ticket, action) => {
  const emails = [];
  if (action === ESCALATION_ACTIONS.NOTIFY_ASSIGNEE || action === ESCALATION_ACTIONS.MARK_BREACHED) {
    if (ticket.assignedTo) {
      const agent = await User.findById(ticket.assignedTo).select("email firstName isActive");
      if (agent?.email && agent.isActive !== false) emails.push(agent.email);
    }
  }
  if (
    action === ESCALATION_ACTIONS.NOTIFY_TEAM_LEAD ||
    action === ESCALATION_ACTIONS.MARK_BREACHED
  ) {
    const team = await Team.findById(ticket.teamId).select("teamLeadId tenantId");
    if (team?.teamLeadId) {
      const lead = await User.findById(team.teamLeadId).select("email isActive");
      if (lead?.email && lead.isActive !== false) emails.push(lead.email);
    }
  }
  if (action === ESCALATION_ACTIONS.NOTIFY_ADMIN || action === ESCALATION_ACTIONS.MARK_BREACHED) {
    const admins = await User.find({
      tenantId: ticket.tenantId,
      role: ROLES.ADMIN,
      isActive: true
    })
      .select("email")
      .limit(5);
    for (const a of admins) {
      if (a.email) emails.push(a.email);
    }
  }
  return [...new Set(emails)];
};

const processTicketEscalation = async (ticket, now = new Date()) => {
  if (!ticket.sla?.currentCycle || ticket.sla.currentCycle.outcome) {
    return { triggered: 0 };
  }

  const tenant = await loadTenantById(ticket.tenantId);
  if (tenant && !isTenantOperable(tenant)) {
    return { triggered: 0, skipped: "tenant_not_operable" };
  }

  const sm = await getServiceManagement(ticket.tenantId);
  refreshCycleStates(ticket.sla.currentCycle, sm, now);

  const rules = (sm.escalationRules || []).filter((r) => r.enabled !== false);
  const triggered = ticket.sla.currentCycle.triggeredThresholds || [];
  let count = 0;

  for (const rule of rules) {
    const metric = rule.metric || SLA_METRIC_TYPES.RESOLUTION;
    const pct =
      metric === SLA_METRIC_TYPES.RESPONSE
        ? ticket.sla.currentCycle.responsePercent || 0
        : ticket.sla.currentCycle.resolutionPercent || 0;
    const key = thresholdKey(metric, rule.thresholdPercent);
    if (pct < rule.thresholdPercent || triggered.includes(key)) {
      continue;
    }

    const recipients = await resolveRecipients(ticket, rule.action);
    const subject = `[SLA ${rule.thresholdPercent}%] ${ticket.ticketNumber}`;
    const body = `Ticket ${ticket.ticketNumber} has reached ${rule.thresholdPercent}% of ${metric} SLA (${pct}%). Priority: ${ticket.priority}.`;

    for (const email of recipients) {
      await notifyEmail(email, subject, body);
    }

    triggered.push(key);
    count += 1;

    const isBreach = rule.thresholdPercent >= 100 || rule.action === ESCALATION_ACTIONS.MARK_BREACHED;
    const auditAction = isBreach
      ? metric === SLA_METRIC_TYPES.RESPONSE
        ? AUDIT_ACTIONS.SLA_RESPONSE_BREACHED
        : AUDIT_ACTIONS.SLA_BREACHED
      : rule.thresholdPercent >= 75
        ? AUDIT_ACTIONS.SLA_ESCALATION_TRIGGERED
        : AUDIT_ACTIONS.SLA_WARNING_TRIGGERED;

    if (isBreach) {
      if (metric === SLA_METRIC_TYPES.RESPONSE && !ticket.sla.currentCycle.responseBreachedAt) {
        ticket.sla.currentCycle.responseBreachedAt = now;
      }
      if (metric === SLA_METRIC_TYPES.RESOLUTION && !ticket.sla.currentCycle.resolutionBreachedAt) {
        ticket.sla.currentCycle.resolutionBreachedAt = now;
      }
    }

    await logAudit({
      entityType: ENTITY_TYPES.TICKET,
      entityId: ticket._id,
      action: auditAction,
      actorType: ACTOR_TYPES.SYSTEM,
      actorName: "SLA escalation worker",
      tenantId: ticket.tenantId || null,
      metadata: {
        ticketNumber: ticket.ticketNumber,
        thresholdPercent: rule.thresholdPercent,
        metric,
        action: rule.action,
        percent: pct,
        cycleNumber: ticket.sla.currentCycle.cycleNumber,
        recipients
      },
      skipNotificationEvent: true
    });

    const conversationService = require("../conversations/conversation.service");
    await conversationService.addSystemEvent(
      ticket._id,
      `SLA ${metric.toLowerCase()} ${rule.thresholdPercent}% threshold reached (${pct}%).`
    );
  }

  ticket.sla.currentCycle.triggeredThresholds = triggered;
  ticket.markModified("sla");
  await ticket.save();
  return { triggered: count };
};

const tick = async () => {
  if (running) return;
  running = true;
  const started = Date.now();
  try {
    const tickets = await Ticket.find({
      status: { $in: ACTIVE_TICKET_STATUSES },
      "sla.currentCycle": { $ne: null }
    })
      .limit(100)
      .sort({ updatedAt: 1 });

    let total = 0;
    for (const ticket of tickets) {
      try {
        const result = await processTicketEscalation(ticket);
        total += result.triggered || 0;
      } catch (err) {
        logger.warn("SLA escalation failed for ticket", {
          ticketId: String(ticket._id),
          tenantId: ticket.tenantId ? String(ticket.tenantId) : null,
          error: err.message
        });
      }
    }

    if (total > 0) {
      logger.info("SLA escalation worker tick", {
        processed: tickets.length,
        triggered: total,
        durationMs: Date.now() - started
      });
    }
  } catch (err) {
    logger.error("SLA escalation worker error", { error: err.message });
  } finally {
    running = false;
  }
};

const start = () => {
  if (timer) return;
  const interval = Number(env.sla?.escalationIntervalMs) || DEFAULT_INTERVAL_MS;
  timer = setInterval(() => {
    tick().catch(() => {});
  }, interval);
  if (typeof timer.unref === "function") timer.unref();
  logger.info("SLA escalation worker started", { intervalMs: interval });
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = {
  start,
  stop,
  tick,
  processTicketEscalation
};
