const { body, param } = require("express-validator");

const createTicketValidation = [
  body("moduleId").isMongoId().withMessage("Valid module id is required"),
  body("subject").trim().notEmpty().withMessage("Subject is required").isLength({ max: 200 }),
  body("description").trim().notEmpty().withMessage("Description is required").isLength({ max: 5000 })
];

const ticketIdParamValidation = [param("id").isMongoId().withMessage("Invalid ticket id")];

const assignValidation = [
  param("id").isMongoId().withMessage("Invalid ticket id"),
  body("userId").isMongoId().withMessage("Valid user id is required")
];

module.exports = {
  createTicketValidation,
  ticketIdParamValidation,
  assignValidation
};
