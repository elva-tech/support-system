const express = require("express");
const { body, param, query } = require("express-validator");
const validate = require("../../shared/middleware/validate.middleware");
const asyncHandler = require("../../shared/utils/asyncHandler");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const {
  requireTenantContext,
  requireTenantMembership
} = require("../../shared/middleware/tenant-context.middleware");
const { handleUpload } = require("../../shared/middleware/upload.middleware");
const { ROLES } = require("../../shared/constants/roles");
const {
  PLATFORM_SUPPORT_CATEGORIES,
  ALL_PLATFORM_SUPPORT_PRIORITIES,
  ALL_PLATFORM_SUPPORT_STATUSES
} = require("../../shared/constants/platform-support");
const service = require("./platform-support.service");

const router = express.Router();

router.use(authenticate);
router.use(requireTenantContext);
router.use(requireTenantMembership);
router.use(authorize(ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.AGENT));

router.get(
  "/context",
  asyncHandler(async (req, res) => {
    const data = await service.getCreateContext({ tenant: req.tenant, user: req.user });
    res.json({ message: "OK", data });
  })
);

router.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    const data = await service.listForTenantUser({
      tenantId: req.tenant._id,
      user: req.user,
      filters: { status: req.query.status, search: req.query.search }
    });
    res.json({ message: "OK", data });
  })
);

router.post(
  "/tickets",
  [
    body("category").isIn(PLATFORM_SUPPORT_CATEGORIES),
    body("subject").trim().notEmpty().isLength({ max: 200 }),
    body("description").trim().notEmpty().isLength({ max: 10000 }),
    body("priority").optional().isString()
  ],
  validate,
  asyncHandler(async (req, res) => {
    // Never trust client tenant/user fields — resolve from session only
    const data = await service.createTicket({
      tenant: req.tenant,
      user: req.user,
      payload: {
        category: req.body.category,
        subject: req.body.subject,
        description: req.body.description,
        priority: req.body.priority
      }
    });
    res.status(201).json({ message: "Support ticket created successfully", data });
  })
);

router.get(
  "/tickets/:id",
  [param("id").isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const data = await service.getForTenantUser({
      tenantId: req.tenant._id,
      user: req.user,
      ticketId: req.params.id
    });
    res.json({ message: "OK", data });
  })
);

router.get(
  "/tickets/:id/timeline",
  [param("id").isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const data = await service.getTimeline({
      ticketId: req.params.id,
      includeInternal: false,
      tenantUser: req.user,
      tenantId: req.tenant._id
    });
    res.json({ message: "OK", data });
  })
);

router.post(
  "/tickets/:id/messages",
  [param("id").isMongoId(), body("message").trim().notEmpty().isLength({ max: 10000 })],
  validate,
  asyncHandler(async (req, res) => {
    const data = await service.addMessage({
      ticketId: req.params.id,
      message: req.body.message,
      senderType: "TENANT_USER",
      tenantUser: req.user,
      tenantId: req.tenant._id
    });
    res.status(201).json({ message: "Message sent", data });
  })
);

router.post(
  "/tickets/:id/attachments",
  [param("id").isMongoId()],
  validate,
  handleUpload,
  asyncHandler(async (req, res) => {
    const data = await service.uploadAttachment({
      ticketId: req.params.id,
      file: req.file,
      tenantUser: req.user,
      tenantId: req.tenant._id,
      uploadedByLabel: [req.user.firstName, req.user.lastName].filter(Boolean).join(" ")
    });
    res.status(201).json({ message: "Attachment uploaded", data });
  })
);

router.get(
  "/tickets/:id/attachments/:attachmentId/download",
  [param("id").isMongoId(), param("attachmentId").isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const attachment = await service.getAttachmentForDownload({
      ticketId: req.params.id,
      attachmentId: req.params.attachmentId,
      tenantUser: req.user,
      tenantId: req.tenant._id
    });
    res.download(attachment.storagePath, attachment.fileName);
  })
);

module.exports = router;
