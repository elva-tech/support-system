const Ticket = require("../../tickets/ticket.model");
const MerchantProfile = require("../../merchants/merchant-profile.model");
const ApplicationProfile = require("../application-profile.model");
const emailThreadService = require("../../email/email-thread.service");
const {
  CLASSIFICATION_MATCHED_BY,
  MATCH_CONFIDENCE
} = require("../../../shared/constants/classification");

const normalizeKeywords = (keywords = []) =>
  keywords.map((keyword) => String(keyword).trim().toLowerCase()).filter(Boolean);

const countKeywordHits = (textLower, keywords) => {
  const normalized = normalizeKeywords(keywords);
  if (!normalized.length || !textLower) {
    return { hits: 0, matchedKeywords: [] };
  }

  const matchedKeywords = normalized.filter((keyword) => textLower.includes(keyword));
  return { hits: matchedKeywords.length, matchedKeywords };
};

const scoreKeywordMatch = (hits, totalKeywords, maxConfidence) => {
  if (!hits || !totalKeywords) {
    return 0;
  }
  const ratio = hits / totalKeywords;
  return Math.min(maxConfidence, Math.max(0.35, ratio * maxConfidence));
};

const toApplicationRef = (application) =>
  application
    ? {
        id: application._id.toString(),
        code: application.code,
        name: application.name
      }
    : null;

/**
 * Detects application context from ticket reference, sender email, and keywords.
 */
class ApplicationDetectionEngine {
  async detectByEmailThread(inReplyTo, references = []) {
    const ticketId = await emailThreadService.findTicketIdByThreadHeaders(inReplyTo, references);
    if (!ticketId) {
      return null;
    }

    const ticket = await Ticket.findById(ticketId)
      .populate("applicationId", "code name")
      .populate("moduleId", "code name");

    if (!ticket) {
      return null;
    }

    return this._buildExistingTicketMatch(ticket);
  }

  async detectByTicketReference(ticketReference) {
    if (!ticketReference) {
      return null;
    }

    const ticket = await Ticket.findOne({ ticketNumber: ticketReference.toUpperCase() })
      .populate("applicationId", "code name")
      .populate("moduleId", "code name");

    if (!ticket) {
      return null;
    }

    return this._buildExistingTicketMatch(ticket);
  }

  _buildExistingTicketMatch(ticket) {
    const application = ticket.applicationId;
    const module = ticket.moduleId;

    return {
      isExistingTicket: true,
      existingTicket: {
        id: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        status: ticket.status
      },
      application: toApplicationRef(application),
      module: module
        ? {
            id: module._id.toString(),
            code: module.code,
            name: module.name
          }
        : null,
      confidence: MATCH_CONFIDENCE.TICKET_REFERENCE,
      matchedBy: CLASSIFICATION_MATCHED_BY.TICKET_REFERENCE
    };
  }

  async detectBySenderEmail(senderEmail) {
    if (!senderEmail) {
      return null;
    }

    const merchant = await MerchantProfile.findOne({
      email: senderEmail.toLowerCase(),
      isActive: true
    }).populate("applicationId", "code name");

    if (!merchant?.applicationId) {
      return null;
    }

    return {
      isExistingTicket: false,
      existingTicket: null,
      application: toApplicationRef(merchant.applicationId),
      module: null,
      merchantId: merchant._id.toString(),
      confidence: MATCH_CONFIDENCE.SENDER_EMAIL,
      matchedBy: CLASSIFICATION_MATCHED_BY.SENDER_EMAIL
    };
  }

  detectByKeywords(textLower, profiles, { matchedBy, maxConfidence }) {
    if (!textLower || !profiles.length) {
      return null;
    }

    let best = null;

    for (const profile of profiles) {
      const application = profile.applicationId;
      if (!application) continue;

      const { hits, matchedKeywords } = countKeywordHits(textLower, profile.keywords);
      if (!hits) continue;

      const confidence = scoreKeywordMatch(hits, profile.keywords.length, maxConfidence);
      const candidate = {
        isExistingTicket: false,
        existingTicket: null,
        application: toApplicationRef(application),
        module: null,
        confidence,
        matchedBy,
        matchedKeywords,
        profileId: profile._id.toString(),
        confidenceThreshold: profile.confidenceThreshold
      };

      if (!best || candidate.confidence > best.confidence) {
        best = candidate;
      }
    }

    return best;
  }

  async loadProfiles() {
    return ApplicationProfile.find()
      .populate("applicationId", "code name isActive")
      .lean()
      .then((profiles) => profiles.filter((profile) => profile.applicationId?.isActive !== false));
  }
}

module.exports = new ApplicationDetectionEngine();
