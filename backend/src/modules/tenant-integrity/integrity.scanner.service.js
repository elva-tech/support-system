const mongoose = require("mongoose");
const Tenant = require("../tenants/tenant.model");
const Ticket = require("../tickets/ticket.model");
const Application = require("../applications/application.model");
const MerchantProfile = require("../merchants/merchant-profile.model");
const NotificationEvent = require("../notifications/notification-event.model");
const {
  INTEGRITY_ISSUE_TYPES,
  INTEGRITY_SEVERITY,
  INTEGRITY_COLLECTIONS,
  ALL_INTEGRITY_COLLECTIONS,
  MAX_FINDINGS_PER_COLLECTION
} = require("./integrity.constants");
const { COLLECTION_REGISTRY, getRegistryEntry } = require("./integrity.registry");
const { idsEqual } = require("../tenants/tenant-resolver.service");

const toId = (value) => (value ? String(value) : null);

const makeFinding = ({
  collection,
  issueType,
  severity,
  recordId,
  actualTenantId = null,
  expectedTenantId = null,
  suggestedTenantId = null,
  relatedRecord = null,
  repairable = false,
  reason = ""
}) => ({
  id: `${collection}:${recordId}:${issueType}`,
  collection,
  issueType,
  severity,
  recordId: toId(recordId),
  actualTenantId: toId(actualTenantId),
  expectedTenantId: toId(expectedTenantId),
  suggestedTenantId: toId(suggestedTenantId),
  relatedRecord,
  repairable: Boolean(repairable),
  reason
});

const loadTenantIdSet = async () => {
  const ids = await Tenant.find({}).select("_id").lean();
  return new Set(ids.map((t) => String(t._id)));
};

/**
 * Derive tenant from a verified parent Ticket when present.
 */
const deriveFromTicket = async (ticketId) => {
  if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
    return null;
  }
  const ticket = await Ticket.findById(ticketId).select("tenantId").lean();
  return ticket?.tenantId || null;
};

const deriveFromApplication = async (applicationId) => {
  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    return null;
  }
  const app = await Application.findById(applicationId).select("tenantId").lean();
  return app?.tenantId || null;
};

const deriveFromMerchant = async (merchantId) => {
  if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
    return null;
  }
  const merchant = await MerchantProfile.findById(merchantId).select("tenantId").lean();
  return merchant?.tenantId || null;
};

const deriveFromNotificationEvent = async (eventId) => {
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    return null;
  }
  const event = await NotificationEvent.findById(eventId).select("tenantId").lean();
  return event?.tenantId || null;
};

const scanMissingAndInvalid = async (collectionKey, tenantIds, limit) => {
  const entry = getRegistryEntry(collectionKey);
  if (!entry) {
    return [];
  }

  const findings = [];
  const cursor = entry.model
    .find({})
    .select("_id tenantId ticketId applicationId merchantId eventId")
    .lean()
    .cursor();

  for await (const doc of cursor) {
    if (findings.length >= limit) {
      break;
    }

    const actual = doc.tenantId || null;
    if (!actual) {
      // Attempt deterministic derivation per collection
      let suggested = null;
      let related = null;
      let repairable = false;

      if (collectionKey === INTEGRITY_COLLECTIONS.emailthreads && doc.ticketId) {
        suggested = await deriveFromTicket(doc.ticketId);
        related = { type: "Ticket", id: toId(doc.ticketId) };
        repairable = Boolean(suggested);
      } else if (
        collectionKey === INTEGRITY_COLLECTIONS.notificationdeliveries &&
        doc.eventId
      ) {
        suggested = await deriveFromNotificationEvent(doc.eventId);
        related = { type: "NotificationEvent", id: toId(doc.eventId) };
        repairable = Boolean(suggested);
      } else if (
        (collectionKey === INTEGRITY_COLLECTIONS.inboundmailqueues ||
          collectionKey === INTEGRITY_COLLECTIONS.classificationqueues) &&
        doc.ticketId
      ) {
        suggested = await deriveFromTicket(doc.ticketId);
        related = { type: "Ticket", id: toId(doc.ticketId) };
        repairable = Boolean(suggested);
      } else if (
        collectionKey === INTEGRITY_COLLECTIONS.merchantsessions &&
        doc.merchantId
      ) {
        suggested = await deriveFromMerchant(doc.merchantId);
        related = { type: "MerchantProfile", id: toId(doc.merchantId) };
        repairable = Boolean(suggested);
      } else if (
        collectionKey === INTEGRITY_COLLECTIONS.teams &&
        doc.applicationId
      ) {
        suggested = await deriveFromApplication(doc.applicationId);
        related = { type: "Application", id: toId(doc.applicationId) };
        repairable = Boolean(suggested);
      }

      findings.push(
        makeFinding({
          collection: collectionKey,
          issueType: INTEGRITY_ISSUE_TYPES.MISSING_TENANT,
          severity: repairable ? INTEGRITY_SEVERITY.WARNING : INTEGRITY_SEVERITY.HIGH,
          recordId: doc._id,
          actualTenantId: null,
          expectedTenantId: suggested,
          suggestedTenantId: suggested,
          relatedRecord: related,
          repairable,
          reason: repairable
            ? "Missing tenantId; ownership can be derived from a verified related record"
            : "Missing tenantId; ownership cannot be derived safely"
        })
      );
      continue;
    }

    if (!tenantIds.has(String(actual))) {
      findings.push(
        makeFinding({
          collection: collectionKey,
          issueType: INTEGRITY_ISSUE_TYPES.INVALID_TENANT_REF,
          severity: INTEGRITY_SEVERITY.CRITICAL,
          recordId: doc._id,
          actualTenantId: actual,
          repairable: false,
          reason: "tenantId references a Tenant that does not exist"
        })
      );
    }
  }

  return findings;
};

const scanTicketMismatches = async (limit) => {
  const findings = [];
  const cursor = Ticket.find({})
    .select("_id tenantId applicationId merchantId")
    .lean()
    .cursor();

  for await (const ticket of cursor) {
    if (findings.length >= limit) {
      break;
    }
    if (!ticket.tenantId) {
      continue; // covered by missing-tenant scan
    }

    if (ticket.applicationId) {
      const appTenant = await deriveFromApplication(ticket.applicationId);
      if (appTenant && !idsEqual(appTenant, ticket.tenantId)) {
        findings.push(
          makeFinding({
            collection: INTEGRITY_COLLECTIONS.tickets,
            issueType: INTEGRITY_ISSUE_TYPES.TENANT_MISMATCH,
            severity: INTEGRITY_SEVERITY.CRITICAL,
            recordId: ticket._id,
            actualTenantId: ticket.tenantId,
            expectedTenantId: appTenant,
            relatedRecord: { type: "Application", id: toId(ticket.applicationId) },
            repairable: false,
            reason: "Ticket.tenantId differs from Application.tenantId"
          })
        );
        continue;
      }
    }

    if (ticket.merchantId) {
      const merchantTenant = await deriveFromMerchant(ticket.merchantId);
      if (merchantTenant && !idsEqual(merchantTenant, ticket.tenantId)) {
        findings.push(
          makeFinding({
            collection: INTEGRITY_COLLECTIONS.tickets,
            issueType: INTEGRITY_ISSUE_TYPES.TENANT_MISMATCH,
            severity: INTEGRITY_SEVERITY.CRITICAL,
            recordId: ticket._id,
            actualTenantId: ticket.tenantId,
            expectedTenantId: merchantTenant,
            relatedRecord: { type: "MerchantProfile", id: toId(ticket.merchantId) },
            repairable: false,
            reason: "Ticket.tenantId differs from MerchantProfile.tenantId"
          })
        );
      }
    }
  }

  return findings;
};

const scanEmailThreadMismatches = async (limit) => {
  const findings = [];
  const EmailThread = COLLECTION_REGISTRY[INTEGRITY_COLLECTIONS.emailthreads].model;
  const cursor = EmailThread.find({ tenantId: { $ne: null } })
    .select("_id tenantId ticketId")
    .lean()
    .cursor();

  for await (const thread of cursor) {
    if (findings.length >= limit) {
      break;
    }
    if (!thread.ticketId) {
      continue;
    }
    const ticketTenant = await deriveFromTicket(thread.ticketId);
    if (ticketTenant && !idsEqual(ticketTenant, thread.tenantId)) {
      findings.push(
        makeFinding({
          collection: INTEGRITY_COLLECTIONS.emailthreads,
          issueType: INTEGRITY_ISSUE_TYPES.TENANT_MISMATCH,
          severity: INTEGRITY_SEVERITY.CRITICAL,
          recordId: thread._id,
          actualTenantId: thread.tenantId,
          expectedTenantId: ticketTenant,
          relatedRecord: { type: "Ticket", id: toId(thread.ticketId) },
          repairable: false,
          reason: "EmailThread.tenantId differs from Ticket.tenantId"
        })
      );
    }
  }

  return findings;
};

const scanDeliveryMismatches = async (limit) => {
  const findings = [];
  const Delivery = COLLECTION_REGISTRY[INTEGRITY_COLLECTIONS.notificationdeliveries].model;
  const cursor = Delivery.find({ tenantId: { $ne: null }, eventId: { $ne: null } })
    .select("_id tenantId eventId")
    .lean()
    .cursor();

  for await (const delivery of cursor) {
    if (findings.length >= limit) {
      break;
    }
    const eventTenant = await deriveFromNotificationEvent(delivery.eventId);
    if (eventTenant && !idsEqual(eventTenant, delivery.tenantId)) {
      findings.push(
        makeFinding({
          collection: INTEGRITY_COLLECTIONS.notificationdeliveries,
          issueType: INTEGRITY_ISSUE_TYPES.TENANT_MISMATCH,
          severity: INTEGRITY_SEVERITY.CRITICAL,
          recordId: delivery._id,
          actualTenantId: delivery.tenantId,
          expectedTenantId: eventTenant,
          relatedRecord: { type: "NotificationEvent", id: toId(delivery.eventId) },
          repairable: false,
          reason: "NotificationDelivery.tenantId differs from NotificationEvent.tenantId"
        })
      );
    }
  }

  return findings;
};

/**
 * On-demand integrity scan. Bounded per collection.
 */
const runIntegrityScan = async ({ collections = null } = {}) => {
  const keys = (collections?.length ? collections : ALL_INTEGRITY_COLLECTIONS).filter((k) =>
    ALL_INTEGRITY_COLLECTIONS.includes(k)
  );

  const tenantIds = await loadTenantIdSet();
  const findings = [];
  const perCollection = {};

  for (const key of keys) {
    const limit = MAX_FINDINGS_PER_COLLECTION;
    const base = await scanMissingAndInvalid(key, tenantIds, limit);
    findings.push(...base);

    if (key === INTEGRITY_COLLECTIONS.tickets) {
      findings.push(...(await scanTicketMismatches(limit)));
    }
    if (key === INTEGRITY_COLLECTIONS.emailthreads) {
      findings.push(...(await scanEmailThreadMismatches(limit)));
    }
    if (key === INTEGRITY_COLLECTIONS.notificationdeliveries) {
      findings.push(...(await scanDeliveryMismatches(limit)));
    }
  }

  for (const key of ALL_INTEGRITY_COLLECTIONS) {
    const collectionFindings = findings.filter((f) => f.collection === key);
    perCollection[key] = {
      collection: key,
      label: COLLECTION_REGISTRY[key]?.label || key,
      healthy: collectionFindings.length === 0,
      findings: collectionFindings.length,
      critical: collectionFindings.filter((f) => f.severity === INTEGRITY_SEVERITY.CRITICAL)
        .length,
      high: collectionFindings.filter((f) => f.severity === INTEGRITY_SEVERITY.HIGH).length,
      warning: collectionFindings.filter((f) => f.severity === INTEGRITY_SEVERITY.WARNING)
        .length
    };
  }

  const summary = {
    scannedAt: new Date().toISOString(),
    collectionsScanned: keys,
    healthyCollections: Object.values(perCollection).filter((c) => c.healthy).length,
    totalCollections: ALL_INTEGRITY_COLLECTIONS.length,
    totalFindings: findings.length,
    criticalFindings: findings.filter((f) => f.severity === INTEGRITY_SEVERITY.CRITICAL)
      .length,
    highFindings: findings.filter((f) => f.severity === INTEGRITY_SEVERITY.HIGH).length,
    warningFindings: findings.filter((f) => f.severity === INTEGRITY_SEVERITY.WARNING).length,
    infoFindings: findings.filter((f) => f.severity === INTEGRITY_SEVERITY.INFO).length,
    missingTenantRecords: findings.filter(
      (f) => f.issueType === INTEGRITY_ISSUE_TYPES.MISSING_TENANT
    ).length,
    mismatchedTenantRecords: findings.filter(
      (f) => f.issueType === INTEGRITY_ISSUE_TYPES.TENANT_MISMATCH
    ).length,
    invalidTenantRefs: findings.filter(
      (f) => f.issueType === INTEGRITY_ISSUE_TYPES.INVALID_TENANT_REF
    ).length,
    collections: Object.values(perCollection)
  };

  return { summary, findings };
};

module.exports = {
  runIntegrityScan,
  makeFinding,
  deriveFromTicket,
  deriveFromApplication,
  deriveFromMerchant,
  deriveFromNotificationEvent
};
