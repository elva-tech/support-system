const { body, param } = require("express-validator");
const { ALL_TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");

const replyValidation = [
  param("id").isMongoId().withMessage("Invalid ticket id"),
  body("message").trim().notEmpty().withMessage("Message is required").isLength({ max: 5000 })
];

const internalNoteValidation = [
  param("id").isMongoId().withMessage("Invalid ticket id"),
  body("message").trim().notEmpty().withMessage("Message is required").isLength({ max: 5000 })
];

const statusValidation = [
  param("id").isMongoId().withMessage("Invalid ticket id"),
  body("status").isIn(ALL_TICKET_STATUSES).withMessage(`Status must be one of: ${ALL_TICKET_STATUSES.join(", ")}`)
];

const transferValidation = [
  param("id").isMongoId().withMessage("Invalid ticket id"),
  body("teamId").isMongoId().withMessage("Valid team id is required")
];

const ticketIdParamValidation = [param("id").isMongoId().withMessage("Invalid ticket id")];

module.exports = {
  replyValidation,
  internalNoteValidation,
  statusValidation,
  transferValidation,
  ticketIdParamValidation
};
