const express = require("express");
const { body, param, query } = require("express-validator");
const validate = require("../../shared/middleware/validate.middleware");
const asyncHandler = require("../../shared/utils/asyncHandler");
const {
  authenticateCentralSupport,
  requireCentralSupportRole
} = require("../../shared/middleware/central-support-auth.middleware");
const { handleUpload } = require("../../shared/middleware/upload.middleware");
const {
  CENTRAL_SUPPORT_ROLES,
  ALL_CENTRAL_SUPPORT_ROLES,
  ALL_CENTRAL_SUPPORT_USER_STATUSES
} = require("../../shared/constants/central-support");
const {
  ALL_PLATFORM_SUPPORT_STATUSES
} = require("../../shared/constants/platform-support");
const supportService = require("../platform-support/platform-support.service");
const userService = require("./central-support-user.service");
const teamService = require("./central-support-team.service");

const router = express.Router();
const { CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD, CENTRAL_SUPPORT_AGENT } =
  CENTRAL_SUPPORT_ROLES;

router.use(authenticateCentralSupport);

// ---------- Agents (ADMIN only for mutations) ----------
router.get(
  "/agents",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD),
  asyncHandler(async (req, res) => {
    const data = await userService.listUsers({
      status: req.query.status,
      role: req.query.role,
      teamId: req.query.teamId
    });
    res.json({ message: "OK", data });
  })
);

router.post(
  "/agents",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN),
  [
    body("name").trim().notEmpty().isLength({ max: 200 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 8 }),
    body("role").isIn([
      CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_AGENT,
      CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD,
      CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN
    ]),
    body("teamId").optional({ nullable: true }).isMongoId()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const data = await userService.createUser({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      teamId: req.body.teamId || null,
      actor: req.centralSupportUser
    });
    res.status(201).json({ message: "Agent created", data });
  })
);

router.patch(
  "/agents/:id",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN),
  [
    param("id").isMongoId(),
    body("name").optional().trim().notEmpty().isLength({ max: 200 }),
    body("email").optional().isEmail().normalizeEmail(),
    body("password").optional().isString().isLength({ min: 8 }),
    body("role").optional().isIn(ALL_CENTRAL_SUPPORT_ROLES),
    body("status").optional().isIn(ALL_CENTRAL_SUPPORT_USER_STATUSES),
    body("teamId").optional({ nullable: true })
  ],
  validate,
  asyncHandler(async (req, res) => {
    const data = await userService.updateUser({
      userId: req.params.id,
      patch: req.body,
      actor: req.centralSupportUser
    });
    res.json({ message: "Agent updated", data });
  })
);

// ---------- Teams ----------
router.get(
  "/teams",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD),
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    let data = await teamService.listTeams({ includeInactive });
    if (req.centralSupportUser.role === CENTRAL_SUPPORT_TEAM_LEAD) {
      data = data.filter(
        (t) =>
          t.id === String(req.centralSupportUser.teamId || "") ||
          t.teamLeadId === String(req.centralSupportUser._id)
      );
    }
    res.json({ message: "OK", data });
  })
);

router.post(
  "/teams",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN),
  [
    body("name").trim().notEmpty().isLength({ max: 200 }),
    body("description").optional().isString().isLength({ max: 2000 }),
    body("teamLeadId").optional({ nullable: true }).isMongoId(),
    body("memberIds").optional().isArray()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const data = await teamService.createTeam({
      name: req.body.name,
      description: req.body.description,
      teamLeadId: req.body.teamLeadId || null,
      memberIds: req.body.memberIds || [],
      actor: req.centralSupportUser
    });
    res.status(201).json({ message: "Team created", data });
  })
);

router.patch(
  "/teams/:id",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN),
  [
    param("id").isMongoId(),
    body("name").optional().trim().notEmpty().isLength({ max: 200 }),
    body("description").optional().isString().isLength({ max: 2000 }),
    body("teamLeadId").optional({ nullable: true }),
    body("memberIds").optional().isArray(),
    body("isActive").optional().isBoolean()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const data = await teamService.updateTeam({
      teamId: req.params.id,
      patch: req.body,
      actor: req.centralSupportUser
    });
    res.json({ message: "Team updated", data });
  })
);

router.delete(
  "/teams/:id",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN),
  [param("id").isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const data = await teamService.deactivateTeam(req.params.id);
    res.json({ message: "Team deactivated", data });
  })
);

// ---------- Tickets (ops) ----------
router.get(
  "/tickets",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD, CENTRAL_SUPPORT_AGENT),
  asyncHandler(async (req, res) => {
    const data = await supportService.listForCentralSupport({
      status: req.query.status,
      priority: req.query.priority,
      category: req.query.category,
      tenantId: req.query.tenantId,
      assignedUserId: req.query.assignedUserId,
      assignedTeamId: req.query.assignedTeamId,
      search: req.query.search,
      mine: req.query.mine === "true",
      teamQueue: req.query.teamQueue === "true",
      actor: req.centralSupportUser,
      limit: req.query.limit,
      skip: req.query.skip
    });
    res.json({ message: "OK", data });
  })
);

router.get(
  "/tickets/assignees",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD),
  asyncHandler(async (_req, res) => {
    const data = await userService.listAssignees();
    res.json({ message: "OK", data });
  })
);

router.get(
  "/tickets/:id",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD, CENTRAL_SUPPORT_AGENT),
  [param("id").isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const data = await supportService.getForCentralSupport({
      ticketId: req.params.id,
      actor: req.centralSupportUser
    });
    res.json({ message: "OK", data });
  })
);

router.get(
  "/tickets/:id/timeline",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD, CENTRAL_SUPPORT_AGENT),
  [param("id").isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const data = await supportService.getTimeline({
      ticketId: req.params.id,
      includeInternal: true,
      downloadBase: "/api/central-support/tickets"
    });
    res.json({ message: "OK", data });
  })
);

router.patch(
  "/tickets/:id/assign",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD),
  [
    param("id").isMongoId(),
    body("assignedUserId").optional({ nullable: true }),
    body("assignedTeamId").optional({ nullable: true }),
    body("unassign").optional().isBoolean()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const data = await supportService.assignTicket({
      ticketId: req.params.id,
      assignedUserId: req.body.assignedUserId,
      assignedTeamId: req.body.assignedTeamId,
      unassign: Boolean(req.body.unassign),
      actor: req.centralSupportUser
    });
    res.json({ message: "Ticket assigned", data });
  })
);

router.patch(
  "/tickets/:id/status",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD, CENTRAL_SUPPORT_AGENT),
  [param("id").isMongoId(), body("status").isIn(ALL_PLATFORM_SUPPORT_STATUSES)],
  validate,
  asyncHandler(async (req, res) => {
    const data = await supportService.updateStatus({
      ticketId: req.params.id,
      status: req.body.status,
      actor: req.centralSupportUser,
      actorKind: "CENTRAL_SUPPORT"
    });
    res.json({ message: "Status updated", data });
  })
);

router.post(
  "/tickets/:id/messages",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD, CENTRAL_SUPPORT_AGENT),
  [
    param("id").isMongoId(),
    body("message").trim().notEmpty().isLength({ max: 10000 }),
    body("internal").optional().isBoolean()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const data = await supportService.addMessage({
      ticketId: req.params.id,
      message: req.body.message,
      senderType: "CENTRAL_SUPPORT",
      actor: req.centralSupportUser,
      internal: Boolean(req.body.internal)
    });
    res.status(201).json({ message: "Message sent", data });
  })
);

router.post(
  "/tickets/:id/attachments",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD, CENTRAL_SUPPORT_AGENT),
  [param("id").isMongoId()],
  validate,
  handleUpload,
  asyncHandler(async (req, res) => {
    const data = await supportService.uploadAttachment({
      ticketId: req.params.id,
      file: req.file,
      centralSupportUser: req.centralSupportUser
    });
    res.status(201).json({ message: "Attachment uploaded", data });
  })
);

router.get(
  "/tickets/:id/attachments/:attachmentId/download",
  requireCentralSupportRole(CENTRAL_SUPPORT_ADMIN, CENTRAL_SUPPORT_TEAM_LEAD, CENTRAL_SUPPORT_AGENT),
  [param("id").isMongoId(), param("attachmentId").isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const attachment = await supportService.getAttachmentForDownload({
      ticketId: req.params.id,
      attachmentId: req.params.attachmentId,
      centralSupportUser: req.centralSupportUser
    });
    res.download(attachment.storagePath, attachment.fileName);
  })
);

module.exports = router;
