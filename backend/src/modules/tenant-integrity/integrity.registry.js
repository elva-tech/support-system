const User = require("../users/user.model");
const Application = require("../applications/application.model");
const Team = require("../teams/team.model");
const MerchantProfile = require("../merchants/merchant-profile.model");
const MerchantSession = require("../merchants/merchant-session.model");
const Ticket = require("../tickets/ticket.model");
const TicketSequence = require("../tickets/ticket-sequence.model");
const EmailThread = require("../email/email-thread.model");
const InboundMailQueue = require("../inbound-mail-queue/inbound-mail-queue.model");
const ClassificationQueue = require("../classification/classification-queue.model");
const NotificationEvent = require("../notifications/notification-event.model");
const NotificationDelivery = require("../notifications/notification-delivery.model");
const AuditLog = require("../audit/audit-log.model");
const { INTEGRITY_COLLECTIONS } = require("./integrity.constants");

/**
 * Registry of allowlisted collections for diagnostics/repair.
 * tenantField: path used for ownership (always tenantId in this system).
 */
const COLLECTION_REGISTRY = {
  [INTEGRITY_COLLECTIONS.users]: {
    model: User,
    label: "Users",
    mongoCollection: "users"
  },
  [INTEGRITY_COLLECTIONS.applications]: {
    model: Application,
    label: "Applications",
    mongoCollection: "applications"
  },
  [INTEGRITY_COLLECTIONS.teams]: {
    model: Team,
    label: "Teams",
    mongoCollection: "teams"
  },
  [INTEGRITY_COLLECTIONS.merchantprofiles]: {
    model: MerchantProfile,
    label: "Clients",
    mongoCollection: "merchantprofiles"
  },
  [INTEGRITY_COLLECTIONS.merchantsessions]: {
    model: MerchantSession,
    label: "Merchant Sessions",
    mongoCollection: "merchantsessions"
  },
  [INTEGRITY_COLLECTIONS.tickets]: {
    model: Ticket,
    label: "Tickets",
    mongoCollection: "tickets"
  },
  [INTEGRITY_COLLECTIONS.ticketsequences]: {
    model: TicketSequence,
    label: "Ticket Sequences",
    mongoCollection: "ticketsequences"
  },
  [INTEGRITY_COLLECTIONS.emailthreads]: {
    model: EmailThread,
    label: "Email Threads",
    mongoCollection: "emailthreads"
  },
  [INTEGRITY_COLLECTIONS.inboundmailqueues]: {
    model: InboundMailQueue,
    label: "Inbound Mail Queue",
    mongoCollection: "inboundmailqueues"
  },
  [INTEGRITY_COLLECTIONS.classificationqueues]: {
    model: ClassificationQueue,
    label: "Classification Queue",
    mongoCollection: "classificationqueues"
  },
  [INTEGRITY_COLLECTIONS.notificationevents]: {
    model: NotificationEvent,
    label: "Notification Events",
    mongoCollection: "notificationevents"
  },
  [INTEGRITY_COLLECTIONS.notificationdeliveries]: {
    model: NotificationDelivery,
    label: "Notification Deliveries",
    mongoCollection: "notificationdeliveries"
  },
  [INTEGRITY_COLLECTIONS.auditlogs]: {
    model: AuditLog,
    label: "Audit Logs",
    mongoCollection: "auditlogs"
  }
};

const getRegistryEntry = (collectionKey) => COLLECTION_REGISTRY[collectionKey] || null;

module.exports = {
  COLLECTION_REGISTRY,
  getRegistryEntry
};
