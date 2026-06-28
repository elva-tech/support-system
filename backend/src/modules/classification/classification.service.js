const ApiError = require("../../shared/utils/ApiError");
const Application = require("../applications/application.model");
const Module = require("../modules/module.model");
const ApplicationProfile = require("./application-profile.model");
const ClassificationQueue = require("./classification-queue.model");
const classificationEngine = require("./engines/classification.engine");
const { CLASSIFICATION_QUEUE_STATUS } = require("../../shared/constants/classification");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");

const listProfiles = async () => {
  const profiles = await ApplicationProfile.find()
    .populate("applicationId", "code name isActive")
    .populate("modules.moduleId", "code name")
    .sort({ createdAt: -1 });

  return profiles;
};

const getProfileById = async (id) => {
  const profile = await ApplicationProfile.findById(id)
    .populate("applicationId", "code name isActive")
    .populate("modules.moduleId", "code name");

  if (!profile) {
    throw new ApiError(404, "Application profile not found");
  }

  return profile;
};

const validateProfileModules = async (applicationId, modules = []) => {
  for (const entry of modules) {
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

const createProfile = async (payload) => {
  const application = await Application.findById(payload.applicationId);
  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  const existing = await ApplicationProfile.findOne({ applicationId: application._id });
  if (existing) {
    throw new ApiError(409, "Application profile already exists for this application");
  }

  await validateProfileModules(application._id, payload.modules || []);

  return ApplicationProfile.create({
    applicationId: application._id,
    keywords: payload.keywords || [],
    modules: payload.modules || [],
    confidenceThreshold: payload.confidenceThreshold
  });
};

const updateProfile = async (id, payload) => {
  const profile = await ApplicationProfile.findById(id);
  if (!profile) {
    throw new ApiError(404, "Application profile not found");
  }

  if (payload.modules) {
    await validateProfileModules(profile.applicationId, payload.modules);
    profile.modules = payload.modules;
  }

  if (payload.keywords) {
    profile.keywords = payload.keywords;
  }

  if (payload.confidenceThreshold != null) {
    profile.confidenceThreshold = payload.confidenceThreshold;
  }

  await profile.save();
  return getProfileById(profile._id);
};

const classifyConversation = async (payload) => {
  const result = await classificationEngine.classify({
    senderEmail: payload.senderEmail,
    subject: payload.subject,
    body: payload.body
  });

  let queueItem = null;

  if (payload.enqueue !== false && result.requiresManualClassification) {
    queueItem = await ClassificationQueue.create({
      senderEmail: payload.senderEmail,
      subject: payload.subject,
      body: payload.body || "",
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

const listQueue = async (filters = {}) => {
  const { page, limit, skip } = parsePagination(filters);
  const query = {};

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

const getQueueItem = async (id) => {
  const item = await ClassificationQueue.findById(id)
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

const resolveQueueItem = async (id, userId, payload) => {
  const item = await ClassificationQueue.findById(id);
  if (!item) {
    throw new ApiError(404, "Classification queue item not found");
  }

  if (item.status !== CLASSIFICATION_QUEUE_STATUS.PENDING) {
    throw new ApiError(400, "Only pending queue items can be resolved");
  }

  const application = await Application.findById(payload.applicationId);
  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  const moduleDoc = await Module.findOne({
    _id: payload.moduleId,
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
  item.resolutionNotes = payload.notes || "";
  item.requiresManualClassification = false;

  await item.save();
  return getQueueItem(item._id);
};

const dismissQueueItem = async (id, userId, notes = "") => {
  const item = await ClassificationQueue.findById(id);
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

  return getQueueItem(item._id);
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
