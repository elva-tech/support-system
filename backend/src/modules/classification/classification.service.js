const ApiError = require("../../shared/utils/ApiError");
const Application = require("../applications/application.model");
const Module = require("../modules/module.model");
const ApplicationProfile = require("./application-profile.model");
const ClassificationQueue = require("./classification-queue.model");
const classificationEngine = require("./engines/classification.engine");
const { CLASSIFICATION_QUEUE_STATUS } = require("../../shared/constants/classification");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");
const { withTenantFilter, stripClientTenantId } = require("../../shared/utils/tenant-scope.util");

const requireTenant = (tenantId) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }
};

const listProfiles = async ({ tenantId } = {}) => {
  requireTenant(tenantId);
  return ApplicationProfile.find(withTenantFilter(tenantId))
    .populate("applicationId", "code name isActive")
    .populate("modules.moduleId", "code name")
    .sort({ createdAt: -1 });
};

const getProfileById = async (id, { tenantId } = {}) => {
  requireTenant(tenantId);
  const profile = await ApplicationProfile.findOne(withTenantFilter(tenantId, { _id: id }))
    .populate("applicationId", "code name isActive")
    .populate("modules.moduleId", "code name");

  if (!profile) {
    throw new ApiError(404, "Application profile not found");
  }

  return profile;
};

const validateProfileModules = async (applicationId, modules = []) => {
  for (const entry of modules) {
    // Modules inherit tenant via parent Application (validated separately)
    const moduleDoc = await Module.findOne({
      _id: entry.moduleId,
      applicationId,
      isActive: true
    });

    if (!moduleDoc) {
      throw new ApiError(400, "Each module must belong to the application and be active");
    }
  }
};

const createProfile = async (payload, { tenantId } = {}) => {
  requireTenant(tenantId);
  const clean = stripClientTenantId(payload);
  const application = await Application.findOne(
    withTenantFilter(tenantId, { _id: clean.applicationId })
  );
  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  const existing = await ApplicationProfile.findOne(
    withTenantFilter(tenantId, { applicationId: application._id })
  );
  if (existing) {
    throw new ApiError(409, "Application profile already exists for this application");
  }

  await validateProfileModules(application._id, clean.modules || []);

  return ApplicationProfile.create({
    tenantId,
    applicationId: application._id,
    keywords: clean.keywords || [],
    modules: clean.modules || [],
    confidenceThreshold: clean.confidenceThreshold
  });
};

const updateProfile = async (id, payload, { tenantId } = {}) => {
  requireTenant(tenantId);
  const clean = stripClientTenantId(payload);
  const profile = await ApplicationProfile.findOne(withTenantFilter(tenantId, { _id: id }));
  if (!profile) {
    throw new ApiError(404, "Application profile not found");
  }

  if (clean.modules) {
    await validateProfileModules(profile.applicationId, clean.modules);
    profile.modules = clean.modules;
  }

  if (clean.keywords) {
    profile.keywords = clean.keywords;
  }

  if (clean.confidenceThreshold != null) {
    profile.confidenceThreshold = clean.confidenceThreshold;
  }

  await profile.save();
  return getProfileById(profile._id, { tenantId });
};

/**
 * HTTP classify uses request tenant via opts.tenantId (client body tenantId ignored).
 * Workers/tests may pass persisted tenantId on the payload.
 */
const classifyConversation = async (payload, { tenantId } = {}) => {
  const clean = stripClientTenantId(payload);
  const effectiveTenantId = tenantId || payload.tenantId || null;

  const result = await classificationEngine.classify({
    senderEmail: clean.senderEmail,
    subject: clean.subject,
    body: clean.body,
    channelMetadata: clean.channelMetadata || {},
    tenantId: effectiveTenantId
  });

  let queueItem = null;
  const resolvedTenantId = result.tenantId || effectiveTenantId || null;

  if (clean.enqueue !== false && result.requiresManualClassification) {
    queueItem = await ClassificationQueue.create({
      ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      senderEmail: clean.senderEmail,
      subject: clean.subject,
      body: clean.body || "",
      ticketReference: result.existingTicket?.ticketNumber || null,
      isExistingTicket: result.isExistingTicket,
      existingTicketId: result.existingTicket?.id || null,
      suggestedApplicationId: result.application?.id || null,
      suggestedModuleId: result.module?.id || null,
      confidence: result.confidence,
      matchedBy: result.matchedBy,
      requiresManualClassification: true,
      classificationResult: result,
      status: CLASSIFICATION_QUEUE_STATUS.PENDING
    });
  }

  return { ...result, queueItemId: queueItem?._id?.toString() || null };
};

const listQueue = async (filters = {}, { tenantId } = {}) => {
  requireTenant(tenantId);
  const { page, limit, skip } = parsePagination(filters);
  // Fail closed for legacy null tenantId rows
  const query = withTenantFilter(tenantId);

  if (filters.status) {
    query.status = filters.status;
  } else {
    query.status = CLASSIFICATION_QUEUE_STATUS.PENDING;
  }

  const [items, total] = await Promise.all([
    ClassificationQueue.find(query)
      .populate("suggestedApplicationId", "code name")
      .populate("suggestedModuleId", "code name")
      .populate("existingTicketId", "ticketNumber status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ClassificationQueue.countDocuments(query)
  ]);

  return {
    data: items,
    pagination: buildPaginationMeta({ page, limit, total })
  };
};

const getQueueItem = async (id, { tenantId } = {}) => {
  requireTenant(tenantId);
  const item = await ClassificationQueue.findOne(withTenantFilter(tenantId, { _id: id }))
    .populate("suggestedApplicationId", "code name")
    .populate("suggestedModuleId", "code name")
    .populate("resolvedApplicationId", "code name")
    .populate("resolvedModuleId", "code name")
    .populate("existingTicketId", "ticketNumber status subject");

  if (!item) {
    throw new ApiError(404, "Classification queue item not found");
  }

  return item;
};

const resolveQueueItem = async (id, userId, payload, { tenantId } = {}) => {
  requireTenant(tenantId);
  const clean = stripClientTenantId(payload);
  const item = await ClassificationQueue.findOne(withTenantFilter(tenantId, { _id: id }));
  if (!item) {
    throw new ApiError(404, "Classification queue item not found");
  }

  if (item.status !== CLASSIFICATION_QUEUE_STATUS.PENDING) {
    throw new ApiError(400, "Only pending queue items can be resolved");
  }

  const application = await Application.findOne(
    withTenantFilter(tenantId, { _id: clean.applicationId })
  );
  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  const moduleDoc = await Module.findOne({
    _id: clean.moduleId,
    applicationId: application._id,
    isActive: true
  });

  if (!moduleDoc) {
    throw new ApiError(400, "Module not found for the selected application");
  }

  item.status = CLASSIFICATION_QUEUE_STATUS.RESOLVED;
  item.resolvedApplicationId = application._id;
  item.resolvedModuleId = moduleDoc._id;
  item.resolvedBy = userId;
  item.resolvedAt = new Date();
  item.resolutionNotes = clean.notes || "";
  item.requiresManualClassification = false;
  item.tenantId = tenantId;

  await item.save();
  return getQueueItem(item._id, { tenantId });
};

const dismissQueueItem = async (id, userId, notes = "", { tenantId } = {}) => {
  requireTenant(tenantId);
  const item = await ClassificationQueue.findOne(withTenantFilter(tenantId, { _id: id }));
  if (!item) {
    throw new ApiError(404, "Classification queue item not found");
  }

  if (item.status !== CLASSIFICATION_QUEUE_STATUS.PENDING) {
    throw new ApiError(400, "Only pending queue items can be dismissed");
  }

  item.status = CLASSIFICATION_QUEUE_STATUS.DISMISSED;
  item.resolvedBy = userId;
  item.resolvedAt = new Date();
  item.resolutionNotes = notes;
  await item.save();

  return getQueueItem(item._id, { tenantId });
};

module.exports = {
  listProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  classifyConversation,
  listQueue,
  getQueueItem,
  resolveQueueItem,
  dismissQueueItem
};
