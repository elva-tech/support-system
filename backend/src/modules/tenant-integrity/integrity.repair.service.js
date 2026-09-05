const mongoose = require("mongoose");
const ApiError = require("../../shared/utils/ApiError");
const Tenant = require("../tenants/tenant.model");
const {
  logPlatformAudit,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../platform-admin/platform-audit.service");
const {
  INTEGRITY_COLLECTIONS,
  ALL_INTEGRITY_COLLECTIONS,
  MAX_AUTO_REPAIR_BATCH,
  INTEGRITY_ISSUE_TYPES
} = require("./integrity.constants");
const { getRegistryEntry } = require("./integrity.registry");
const {
  runIntegrityScan,
  deriveFromTicket,
  deriveFromMerchant,
  deriveFromApplication,
  deriveFromNotificationEvent
} = require("./integrity.scanner.service");
const { idsEqual } = require("../tenants/tenant-resolver.service");

/**
 * Resolve deterministic suggested tenant for a record, or null if ambiguous.
 */
const resolveDeterministicTenant = async (collectionKey, doc) => {
  if (collectionKey === INTEGRITY_COLLECTIONS.emailthreads && doc.ticketId) {
    return deriveFromTicket(doc.ticketId);
  }
  if (collectionKey === INTEGRITY_COLLECTIONS.notificationdeliveries && doc.eventId) {
    return deriveFromNotificationEvent(doc.eventId);
  }
  if (
    (collectionKey === INTEGRITY_COLLECTIONS.inboundmailqueues ||
      collectionKey === INTEGRITY_COLLECTIONS.classificationqueues) &&
    doc.ticketId
  ) {
    return deriveFromTicket(doc.ticketId);
  }
  if (collectionKey === INTEGRITY_COLLECTIONS.merchantsessions && doc.merchantId) {
    return deriveFromMerchant(doc.merchantId);
  }
  if (collectionKey === INTEGRITY_COLLECTIONS.teams && doc.applicationId) {
    return deriveFromApplication(doc.applicationId);
  }
  return null;
};

const applyTenantId = async (collectionKey, recordId, newTenantId, { dryRun = false } = {}) => {
  const entry = getRegistryEntry(collectionKey);
  if (!entry) {
    throw new ApiError(400, "Collection is not allowed for repair", {
      code: "INVALID_INTEGRITY_COLLECTION"
    });
  }

  if (!mongoose.Types.ObjectId.isValid(recordId)) {
    throw new ApiError(400, "Invalid record id");
  }
  if (!mongoose.Types.ObjectId.isValid(newTenantId)) {
    throw new ApiError(400, "Invalid tenant id");
  }

  const tenant = await Tenant.findById(newTenantId).select("_id slug name").lean();
  if (!tenant) {
    throw new ApiError(404, "Tenant not found");
  }

  const doc = await entry.model.findById(recordId);
  if (!doc) {
    throw new ApiError(404, "Record not found");
  }

  const oldTenantId = doc.tenantId ? String(doc.tenantId) : null;

  // Reject changes that would worsen a known parent mismatch when parent exists
  if (collectionKey === INTEGRITY_COLLECTIONS.emailthreads && doc.ticketId) {
    const ticketTenant = await deriveFromTicket(doc.ticketId);
    if (ticketTenant && !idsEqual(ticketTenant, newTenantId)) {
      throw new ApiError(400, "Repair would violate Ticket ownership", {
        code: "REPAIR_RELATIONSHIP_VIOLATION"
      });
    }
  }

  if (collectionKey === INTEGRITY_COLLECTIONS.tickets) {
    if (doc.applicationId) {
      const appTenant = await deriveFromApplication(doc.applicationId);
      if (appTenant && !idsEqual(appTenant, newTenantId)) {
        throw new ApiError(400, "Repair would violate Application ownership", {
          code: "REPAIR_RELATIONSHIP_VIOLATION"
        });
      }
    }
    if (doc.merchantId) {
      const merchantTenant = await deriveFromMerchant(doc.merchantId);
      if (merchantTenant && !idsEqual(merchantTenant, newTenantId)) {
        throw new ApiError(400, "Repair would violate Merchant ownership", {
          code: "REPAIR_RELATIONSHIP_VIOLATION"
        });
      }
    }
  }

  if (!dryRun) {
    doc.tenantId = newTenantId;
    await doc.save();
  }

  return {
    collection: collectionKey,
    recordId: String(recordId),
    oldTenantId,
    newTenantId: String(newTenantId),
    dryRun: Boolean(dryRun),
    tenantSlug: tenant.slug
  };
};

const repairManual = async (
  { collection, recordId, tenantId, confirmation },
  { actor } = {}
) => {
  if (confirmation !== true) {
    await logPlatformAudit({
      actorPlatformAdminId: actor?._id,
      actorEmail: actor?.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_DATA_REPAIR_REJECTED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.INTEGRITY,
      metadata: { reason: "confirmation_required", collection, recordId }
    }).catch(() => null);
    throw new ApiError(400, "Explicit confirmation is required");
  }

  if (!ALL_INTEGRITY_COLLECTIONS.includes(collection)) {
    throw new ApiError(400, "Collection is not allowed for repair", {
      code: "INVALID_INTEGRITY_COLLECTION"
    });
  }

  try {
    const result = await applyTenantId(collection, recordId, tenantId, { dryRun: false });
    await logPlatformAudit({
      actorPlatformAdminId: actor?._id,
      actorEmail: actor?.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_DATA_REPAIRED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.INTEGRITY,
      targetId: recordId,
      metadata: {
        collection,
        recordId: result.recordId,
        oldTenantId: result.oldTenantId,
        newTenantId: result.newTenantId,
        repairType: "MANUAL",
        reason: "Platform Super Admin manual assignment"
      }
    });
    return result;
  } catch (err) {
    await logPlatformAudit({
      actorPlatformAdminId: actor?._id,
      actorEmail: actor?.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_DATA_REPAIR_REJECTED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.INTEGRITY,
      metadata: {
        collection,
        recordId,
        reason: err.message,
        code: err.details?.code
      }
    }).catch(() => null);
    throw err;
  }
};

const repairAuto = async (
  { collection, dryRun = true, confirmation = false, limit = MAX_AUTO_REPAIR_BATCH },
  { actor } = {}
) => {
  if (!ALL_INTEGRITY_COLLECTIONS.includes(collection)) {
    throw new ApiError(400, "Collection is not allowed for repair", {
      code: "INVALID_INTEGRITY_COLLECTION"
    });
  }

  if (!dryRun && confirmation !== true) {
    throw new ApiError(400, "Explicit confirmation is required for non-dry-run auto repair");
  }

  const batchLimit = Math.min(
    Math.max(parseInt(limit, 10) || MAX_AUTO_REPAIR_BATCH, 1),
    MAX_AUTO_REPAIR_BATCH
  );

  const { findings } = await runIntegrityScan({ collections: [collection] });
  const candidates = findings
    .filter(
      (f) =>
        f.collection === collection &&
        f.repairable === true &&
        f.issueType === INTEGRITY_ISSUE_TYPES.MISSING_TENANT &&
        f.suggestedTenantId
    )
    .slice(0, batchLimit);

  const results = [];
  for (const finding of candidates) {
    const applied = await applyTenantId(collection, finding.recordId, finding.suggestedTenantId, {
      dryRun
    });
    results.push({
      ...applied,
      findingId: finding.id,
      reason: finding.reason
    });
  }

  if (!dryRun) {
    await logPlatformAudit({
      actorPlatformAdminId: actor?._id,
      actorEmail: actor?.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_DATA_AUTO_REPAIR_COMPLETED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.INTEGRITY,
      metadata: {
        collection,
        repairedCount: results.length,
        dryRun: false,
        repairType: "AUTO",
        recordIds: results.map((r) => r.recordId)
      }
    });
  }

  return {
    dryRun: Boolean(dryRun),
    collection,
    candidateCount: candidates.length,
    processed: results.length,
    results
  };
};

module.exports = {
  repairManual,
  repairAuto,
  applyTenantId,
  resolveDeterministicTenant
};
