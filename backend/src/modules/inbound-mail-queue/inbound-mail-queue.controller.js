const asyncHandler = require("../../shared/utils/asyncHandler");
const inboundMailQueueService = require("./inbound-mail-queue.service");

const listQueue = asyncHandler(async (req, res) => {
  const result = await inboundMailQueueService.listQueue(req.query);
  res.json(result);
});

const getQueueItem = asyncHandler(async (req, res) => {
  const data = await inboundMailQueueService.getQueueItem(req.params.id);
  res.json({ data });
});

const assignToTeam = asyncHandler(async (req, res) => {
  const data = await inboundMailQueueService.assignToTeam(req.params.id, req.user, req.body);
  res.json({ message: "Inbound mail assigned and ticket created", data });
});

const rejectMail = asyncHandler(async (req, res) => {
  const data = await inboundMailQueueService.rejectMail(req.params.id, req.user, req.body.reason);
  res.json({ message: "Inbound mail rejected and sender notified", data });
});

const downloadAttachment = asyncHandler(async (req, res) => {
  const file = await inboundMailQueueService.getAttachmentDownload(
    req.params.id,
    req.params.attachmentId
  );
  res.download(file.filePath, file.fileName, { headers: { "Content-Type": file.mimeType } });
});

module.exports = {
  listQueue,
  getQueueItem,
  assignToTeam,
  rejectMail,
  downloadAttachment
};
