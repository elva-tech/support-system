const CollaborationEnquiry = require("./collaboration-enquiry.model");
const ApiError = require("../../shared/utils/ApiError");
const notificationManager = require("../notifications/notification-manager.service");
const logger = require("../../shared/utils/logger");
const env = require("../../config/env");

const toPublic = (doc) => {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    organizationName: o.organizationName,
    contactPerson: o.contactPerson,
    businessEmail: o.businessEmail,
    status: o.status,
    createdAt: o.createdAt
  };
};

const createEnquiry = async (payload, { sourceHost } = {}) => {
  const organizationName = String(payload.organizationName || "").trim();
  const contactPerson = String(payload.contactPerson || "").trim();
  const businessEmail = String(payload.businessEmail || "").trim().toLowerCase();
  const message = String(payload.message || "").trim();

  if (!organizationName || !contactPerson || !businessEmail || !message) {
    throw new ApiError(400, "Organization name, contact person, business email, and message are required");
  }

  const enquiry = await CollaborationEnquiry.create({
    organizationName,
    contactPerson,
    businessEmail,
    phone: String(payload.phone || "").trim(),
    organizationWebsite: String(payload.organizationWebsite || "").trim(),
    expectedTeamSize: String(payload.expectedTeamSize || "").trim(),
    message,
    sourceHost: sourceHost || ""
  });

  const notifyTo = env.email?.supportAddress || "support@elvatech.in";
  try {
    await notificationManager.sendEmail({
      to: notifyTo,
      subject: `[ELVA Collaborate] ${organizationName}`,
      html: `
        <p>New collaboration enquiry from the public site.</p>
        <ul>
          <li><strong>Organization:</strong> ${escapeHtml(organizationName)}</li>
          <li><strong>Contact:</strong> ${escapeHtml(contactPerson)}</li>
          <li><strong>Email:</strong> ${escapeHtml(businessEmail)}</li>
          <li><strong>Phone:</strong> ${escapeHtml(payload.phone || "")}</li>
          <li><strong>Website:</strong> ${escapeHtml(payload.organizationWebsite || "")}</li>
          <li><strong>Team size:</strong> ${escapeHtml(payload.expectedTeamSize || "")}</li>
        </ul>
        <p><strong>Message</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      `
    });
  } catch (err) {
    logger.warn("Collaboration enquiry email notify failed", { error: err.message, enquiryId: enquiry._id });
  }

  return toPublic(enquiry);
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

module.exports = { createEnquiry, toPublic };
