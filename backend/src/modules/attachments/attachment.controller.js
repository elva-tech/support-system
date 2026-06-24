const fs = require("fs");
const asyncHandler = require("../../shared/utils/asyncHandler");
const attachmentService = require("./attachment.service");

const download = asyncHandler(async (req, res) => {
  const file = await attachmentService.getAttachmentForDownload({
    attachmentId: req.params.id,
    user: req.user,
    merchant: req.merchant
  });

  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);

  if (file.stream) {
    file.stream.pipe(res);
    return;
  }

  const stream = fs.createReadStream(file.filePath);
  stream.pipe(res);
});

module.exports = { download };
