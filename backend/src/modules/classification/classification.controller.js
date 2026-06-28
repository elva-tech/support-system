const asyncHandler = require("../../shared/utils/asyncHandler");
const classificationService = require("./classification.service");

const listProfiles = asyncHandler(async (_req, res) => {
  const data = await classificationService.listProfiles();
  res.json({ data });
});

const getProfile = asyncHandler(async (req, res) => {
  const data = await classificationService.getProfileById(req.params.id);
  res.json({ data });
});

const createProfile = asyncHandler(async (req, res) => {
  const data = await classificationService.createProfile(req.body);
  res.status(201).json({ message: "Application profile created", data });
});

const updateProfile = asyncHandler(async (req, res) => {
  const data = await classificationService.updateProfile(req.params.id, req.body);
  res.json({ message: "Application profile updated", data });
});

const classify = asyncHandler(async (req, res) => {
  const data = await classificationService.classifyConversation(req.body);
  res.json({ data });
});

const listQueue = asyncHandler(async (req, res) => {
  const result = await classificationService.listQueue(req.query);
  res.json(result);
});

const getQueueItem = asyncHandler(async (req, res) => {
  const data = await classificationService.getQueueItem(req.params.id);
  res.json({ data });
});

const resolveQueueItem = asyncHandler(async (req, res) => {
  const data = await classificationService.resolveQueueItem(req.params.id, req.user._id, req.body);
  res.json({ message: "Classification resolved", data });
});

const dismissQueueItem = asyncHandler(async (req, res) => {
  const data = await classificationService.dismissQueueItem(
    req.params.id,
    req.user._id,
    req.body.notes
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
