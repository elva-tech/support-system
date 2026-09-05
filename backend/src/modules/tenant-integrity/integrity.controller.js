const asyncHandler = require("../../shared/utils/asyncHandler");
const { runIntegrityScan } = require("./integrity.scanner.service");
const { repairManual, repairAuto } = require("./integrity.repair.service");
const {
  logPlatformAudit,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../platform-admin/platform-audit.service");
const { ALL_INTEGRITY_COLLECTIONS } = require("./integrity.constants");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");

const actorCtx = (req) => ({ actor: req.platformAdmin });

const getSummary = asyncHandler(async (req, res) => {
  const collections = req.query.collection
    ? [req.query.collection].flat().filter((c) => ALL_INTEGRITY_COLLECTIONS.includes(c))
    : null;

  const { summary } = await runIntegrityScan({ collections });
  res.json({ data: summary });
});

const listFindings = asyncHandler(async (req, res) => {
  const collections = req.query.collection
    ? [req.query.collection].flat().filter((c) => ALL_INTEGRITY_COLLECTIONS.includes(c))
    : null;

  const { findings, summary } = await runIntegrityScan({ collections });

  let filtered = findings;
  if (req.query.severity) {
    filtered = filtered.filter((f) => f.severity === req.query.severity);
  }
  if (req.query.issueType) {
    filtered = filtered.filter((f) => f.issueType === req.query.issueType);
  }
  if (req.query.repairable === "true") {
    filtered = filtered.filter((f) => f.repairable === true);
  }
  if (req.query.repairable === "false") {
    filtered = filtered.filter((f) => f.repairable === false);
  }

  const { page, limit, skip } = parsePagination({
    page: req.query.page,
    limit: req.query.limit || 25
  });
  const pageItems = filtered.slice(skip, skip + limit);

  res.json({
    data: pageItems,
    pagination: buildPaginationMeta({ page, limit, total: filtered.length }),
    summary: {
      totalFindings: summary.totalFindings,
      filteredTotal: filtered.length,
      criticalFindings: summary.criticalFindings,
      highFindings: summary.highFindings,
      warningFindings: summary.warningFindings
    }
  });
});

const getFinding = asyncHandler(async (req, res) => {
  const { collection, recordId } = req.params;
  if (!ALL_INTEGRITY_COLLECTIONS.includes(collection)) {
    return res.status(404).json({ message: "Finding not found" });
  }

  const { findings } = await runIntegrityScan({ collections: [collection] });
  const match = findings.find((f) => f.recordId === recordId);
  if (!match) {
    return res.status(404).json({ message: "Finding not found" });
  }
  res.json({ data: match });
});

const scan = asyncHandler(async (req, res) => {
  const collections = req.body?.collections?.length
    ? req.body.collections.filter((c) => ALL_INTEGRITY_COLLECTIONS.includes(c))
    : null;

  await logPlatformAudit({
    actorPlatformAdminId: req.platformAdmin._id,
    actorEmail: req.platformAdmin.email,
    action: PLATFORM_AUDIT_ACTIONS.TENANT_INTEGRITY_SCAN_STARTED,
    targetType: PLATFORM_AUDIT_TARGET_TYPES.INTEGRITY,
    metadata: { mode: "full", collections: collections || "ALL" }
  });

  const result = await runIntegrityScan({ collections });

  await logPlatformAudit({
    actorPlatformAdminId: req.platformAdmin._id,
    actorEmail: req.platformAdmin.email,
    action: PLATFORM_AUDIT_ACTIONS.TENANT_INTEGRITY_SCAN_COMPLETED,
    targetType: PLATFORM_AUDIT_TARGET_TYPES.INTEGRITY,
    metadata: {
      mode: "full",
      totalFindings: result.summary.totalFindings,
      criticalFindings: result.summary.criticalFindings
    }
  });

  res.json({ data: result.summary, findingsCount: result.findings.length });
});

const repair = asyncHandler(async (req, res) => {
  const data = await repairManual(req.body, actorCtx(req));
  res.json({ message: "Record repaired", data });
});

const repairAutoEndpoint = asyncHandler(async (req, res) => {
  const data = await repairAuto(req.body, actorCtx(req));
  res.json({
    message: data.dryRun ? "Auto-repair dry run completed" : "Auto-repair completed",
    data
  });
});

module.exports = {
  getSummary,
  listFindings,
  getFinding,
  scan,
  repair,
  repairAutoEndpoint
};
