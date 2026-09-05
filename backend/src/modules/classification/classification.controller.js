const asyncHandler = require("../../shared/utils/asyncHandler");
const classificationService = require("./classification.service");

const tenantCtx = (req) => ({ tenantId: req.tenant._id });

const listProfiles = asyncHandler(async (req, res) => {
  const data = await classificationService.listProfiles(tenantCtx(req));
  res.json({ data });
});

const getProfile = asyncHandler(async (req, res) => {
  const data = await classificationService.getProfileById(req.params.id, tenantCtx(req));
  res.json({ data });
});

const createProfile = asyncHandler(async (req, res) => {
  const data = await classificationService.createProfile(req.body, tenantCtx(req));
  res.status(201).json({ message: "Application profile created", data });
});

const updateProfile = asyncHandler(async (req, res) => {
  const data = await classificationService.updateProfile(req.params.id, req.body, tenantCtx(req));
  res.json({ message: "Application profile updated", data });
});

const classify = asyncHandler(async (req, res) => {
  const data = await classificationService.classifyConversation(req.body, tenantCtx(req));
  res.json({ data });
});

const listQueue = asyncHandler(async (req, res) => {
  const result = await classificationService.listQueue(req.query, tenantCtx(req));
  res.json(result);
});

const getQueueItem = asyncHandler(async (req, res) => {
  const data = await classificationService.getQueueItem(req.params.id, tenantCtx(req));
  res.json({ data });
});

const resolveQueueItem = asyncHandler(async (req, res) => {
  const data = await classificationService.resolveQueueItem(
    req.params.id,
    req.user._id,
    req.body,
    tenantCtx(req)
  );
  res.json({ message: "Classification resolved", data });
});

const dismissQueueItem = asyncHandler(async (req, res) => {
  const data = await classificationService.dismissQueueItem(
    req.params.id,
    req.user._id,
    req.body.notes,
    tenantCtx(req)
  );
  res.json({ message: "Classification item dismissed", data });
});

module.exports = {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  classify,
  listQueue,
  getQueueItem,
  resolveQueueItem,
  dismissQueueItem
};
