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
 * Tenant-safe: never auto-assign when the same email or ticket number spans tenants.
 */
class ApplicationDetectionEngine {
  async detectByEmailThread(inReplyTo, references = []) {
    const context = await emailThreadService.findTicketContextByThreadHeaders(inReplyTo, references);
    if (!context) {
      return null;
    }

    if (context.ambiguous) {
      return {
        isExistingTicket: false,
        existingTicket: null,
        application: null,
        module: null,
        tenantId: null,
        confidence: 0,
        matchedBy: CLASSIFICATION_MATCHED_BY.AMBIGUOUS_TICKET_REFERENCE,
        requiresManualClassification: true,
        routingStatus: "AMBIGUOUS",
        routingReason: "EMAIL_THREAD_MATCHES_MULTIPLE_TENANTS"
      };
    }

    const ticket = await Ticket.findById(context.ticketId)
      .populate("applicationId", "code name")
      .populate("moduleId", "code name");

    if (!ticket) {
      return null;
    }

    return this._buildExistingTicketMatch(ticket, CLASSIFICATION_MATCHED_BY.EMAIL_THREAD);
  }

  async detectByTicketReference(ticketReference) {
    if (!ticketReference) {
      return null;
    }

    const tickets = await Ticket.find({ ticketNumber: ticketReference.toUpperCase() })
      .populate("applicationId", "code name")
      .populate("moduleId", "code name")
      .limit(5);

    if (!tickets.length) {
      return null;
    }

    if (tickets.length > 1) {
      const tenantKeys = new Set(
        tickets.map((ticket) => (ticket.tenantId ? ticket.tenantId.toString() : "null"))
      );
      if (tenantKeys.size > 1) {
        return {
          isExistingTicket: false,
          existingTicket: null,
          application: null,
          module: null,
          tenantId: null,
          confidence: 0,
          matchedBy: CLASSIFICATION_MATCHED_BY.AMBIGUOUS_TICKET_REFERENCE,
          requiresManualClassification: true,
          routingStatus: "AMBIGUOUS",
          routingReason: "TICKET_NUMBER_EXISTS_IN_MULTIPLE_TENANTS"
        };
      }
    }

    return this._buildExistingTicketMatch(tickets[0], CLASSIFICATION_MATCHED_BY.TICKET_REFERENCE);
  }

  _buildExistingTicketMatch(ticket, matchedBy = CLASSIFICATION_MATCHED_BY.TICKET_REFERENCE) {
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
      tenantId: ticket.tenantId || null,
      confidence: MATCH_CONFIDENCE.TICKET_REFERENCE,
      matchedBy,
      routingStatus: ticket.tenantId ? "RESOLVED" : "UNRESOLVED"
    };
  }

  async detectBySenderEmail(senderEmail) {
    if (!senderEmail) {
      return null;
    }

    const merchants = await MerchantProfile.find({
      email: senderEmail.toLowerCase(),
      isActive: true
    })
      .populate("applicationId", "code name")
      .limit(10);

    if (!merchants.length) {
      return null;
    }

    if (merchants.length > 1) {
      const tenantKeys = new Set(
        merchants.map((merchant) => (merchant.tenantId ? merchant.tenantId.toString() : "null"))
      );
      if (tenantKeys.size > 1) {
        return {
          isExistingTicket: false,
          existingTicket: null,
          application: null,
          module: null,
          tenantId: null,
          confidence: 0,
          matchedBy: CLASSIFICATION_MATCHED_BY.AMBIGUOUS_SENDER,
          requiresManualClassification: true,
          routingStatus: "AMBIGUOUS",
          routingReason: "SENDER_EMAIL_EXISTS_IN_MULTIPLE_TENANTS"
        };
      }
    }

    const merchant = merchants[0];
    if (!merchant?.applicationId) {
      return null;
    }

    return {
      isExistingTicket: false,
      existingTicket: null,
      application: toApplicationRef(merchant.applicationId),
      module: null,
      merchantId: merchant._id.toString(),
      tenantId: merchant.tenantId || null,
      confidence: MATCH_CONFIDENCE.SENDER_EMAIL,
      matchedBy: CLASSIFICATION_MATCHED_BY.SENDER_EMAIL,
      routingStatus: merchant.tenantId ? "RESOLVED" : "UNRESOLVED"
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
        tenantId: profile.tenantId || application.tenantId || null,
        confidence,
        matchedBy,
        matchedKeywords,
        profileId: profile._id.toString(),
        confidenceThreshold: profile.confidenceThreshold,
        routingStatus: profile.tenantId ? "RESOLVED" : "UNRESOLVED"
      };

      if (!best || candidate.confidence > best.confidence) {
        best = candidate;
      }
    }

    return best;
  }

  async loadProfiles(tenantId = null) {
    const query = tenantId ? { tenantId } : {};
    return ApplicationProfile.find(query)
      .populate("applicationId", "code name isActive tenantId")
      .lean()
      .then((profiles) => profiles.filter((profile) => profile.applicationId?.isActive !== false));
  }
}

module.exports = new ApplicationDetectionEngine();
