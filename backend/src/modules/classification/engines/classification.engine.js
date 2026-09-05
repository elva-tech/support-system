const conversationEngine = require("./conversation.engine");
const applicationDetectionEngine = require("./application-detection.engine");
const moduleDetectionEngine = require("./module-detection.engine");
const ApplicationProfile = require("../application-profile.model");
const Module = require("../../modules/module.model");
const {
  CLASSIFICATION_MATCHED_BY,
  MATCH_CONFIDENCE,
  DEFAULT_CONFIDENCE_THRESHOLD
} = require("../../../shared/constants/classification");

const buildDetectionResponse = ({
  isExistingTicket = false,
  existingTicket = null,
  application = null,
  module = null,
  confidence = 0,
  matchedBy = CLASSIFICATION_MATCHED_BY.MANUAL,
  requiresManualClassification = true,
  merchantId = null,
  tenantId = null,
  routingStatus = null,
  routingReason = null
}) => ({
  isExistingTicket,
  existingTicket,
  application,
  module,
  confidence: Number(confidence.toFixed(4)),
  matchedBy,
  requiresManualClassification,
  tenantId: tenantId || null,
  routingStatus,
  routingReason,
  ...(merchantId && { merchantId })
});

/**
 * Orchestrates classification before ticket processing.
 *
 * Detection order (tenant-safe):
 * 1. Email thread headers → Ticket → tenantId
 * 2. Ticket reference (reject cross-tenant ambiguity)
 * 3. Sender email (reject same-email-across-tenants ambiguity)
 * 4. Subject/body keywords (only when tenantId is already known)
 * 5. Manual / unresolved queue
 */
class ClassificationEngine {
  async classify(input = {}) {
    const conversation = conversationEngine.parse(input);
    const channelMetadata = input.channelMetadata || {};
    let knownTenantId = input.tenantId || null;

    // 1. Email thread headers (In-Reply-To / References)
    const threadMatch = await applicationDetectionEngine.detectByEmailThread(
      channelMetadata.inReplyTo,
      channelMetadata.references
    );
    if (threadMatch?.routingStatus === "AMBIGUOUS") {
      return buildDetectionResponse({
        ...threadMatch,
        requiresManualClassification: true
      });
    }
    if (threadMatch?.isExistingTicket) {
      return buildDetectionResponse({
        ...threadMatch,
        requiresManualClassification: false,
        routingStatus: threadMatch.routingStatus || "RESOLVED"
      });
    }

    // 2. Ticket reference in subject/body — existing ticket
    const ticketMatch = await applicationDetectionEngine.detectByTicketReference(
      conversation.ticketReference
    );
    if (ticketMatch?.routingStatus === "AMBIGUOUS") {
      return buildDetectionResponse({
        ...ticketMatch,
        requiresManualClassification: true
      });
    }
    if (ticketMatch?.isExistingTicket) {
      return buildDetectionResponse({
        ...ticketMatch,
        requiresManualClassification: false,
        routingStatus: ticketMatch.routingStatus || "RESOLVED"
      });
    }

    // 3. Sender email — application from merchant (unique tenant only)
    const senderMatch = await applicationDetectionEngine.detectBySenderEmail(conversation.senderEmail);
    if (senderMatch?.routingStatus === "AMBIGUOUS") {
      return buildDetectionResponse({
        ...senderMatch,
        requiresManualClassification: true
      });
    }

    if (senderMatch) {
      knownTenantId = senderMatch.tenantId || knownTenantId;
      const profiles = await this._loadProfiles(knownTenantId);
      const enriched = await this._enrichWithModuleKeywords(senderMatch, conversation, profiles, {
        preferSubject: true
      });
      const withDefaultModule = enriched.module
        ? enriched
        : await this._applyDefaultModule(enriched);
      return this._finalize(withDefaultModule, profiles);
    }

    // 4–5. Keywords only when tenant is already known (never guess across tenants).
    if (!knownTenantId) {
      return buildDetectionResponse({
        matchedBy: CLASSIFICATION_MATCHED_BY.MANUAL,
        requiresManualClassification: true,
        confidence: 0,
        routingStatus: "UNRESOLVED",
        routingReason: "TENANT_NOT_DETERMINED"
      });
    }

    const profiles = await this._loadProfiles(knownTenantId);

    const subjectAppMatch = applicationDetectionEngine.detectByKeywords(
      conversation.subjectLower,
      profiles,
      {
        matchedBy: CLASSIFICATION_MATCHED_BY.SUBJECT_KEYWORDS,
        maxConfidence: MATCH_CONFIDENCE.SUBJECT_KEYWORDS_MAX
      }
    );

    if (subjectAppMatch) {
      const withModule = await this._attachModuleFromProfile(
        subjectAppMatch,
        conversation.subjectLower,
        profiles,
        CLASSIFICATION_MATCHED_BY.SUBJECT_KEYWORDS,
        MATCH_CONFIDENCE.SUBJECT_KEYWORDS_MAX
      );
      return this._finalize({ ...withModule, tenantId: knownTenantId }, profiles);
    }

    const bodyAppMatch = applicationDetectionEngine.detectByKeywords(
      conversation.bodyLower,
      profiles,
      {
        matchedBy: CLASSIFICATION_MATCHED_BY.BODY_KEYWORDS,
        maxConfidence: MATCH_CONFIDENCE.BODY_KEYWORDS_MAX
      }
    );

    if (bodyAppMatch) {
      const withModule = await this._attachModuleFromProfile(
        bodyAppMatch,
        conversation.bodyLower,
        profiles,
        CLASSIFICATION_MATCHED_BY.BODY_KEYWORDS,
        MATCH_CONFIDENCE.BODY_KEYWORDS_MAX
      );
      return this._finalize({ ...withModule, tenantId: knownTenantId }, profiles);
    }

    return buildDetectionResponse({
      matchedBy: CLASSIFICATION_MATCHED_BY.MANUAL,
      requiresManualClassification: true,
      confidence: 0,
      tenantId: knownTenantId,
      routingStatus: knownTenantId ? "RESOLVED" : "UNRESOLVED",
      routingReason: knownTenantId ? null : "TENANT_NOT_DETERMINED"
    });
  }

  async _applyDefaultModule(match) {
    if (!match.application?.id || match.module) {
      return match;
    }

    const moduleQuery = {
      applicationId: match.application.id,
      isActive: true
    };

    const moduleDoc = await Module.findOne(moduleQuery)
      .sort({ name: 1 })
      .select("code name");

    if (!moduleDoc) {
      return match;
    }

    return {
      ...match,
      module: {
        id: moduleDoc._id.toString(),
        code: moduleDoc.code,
        name: moduleDoc.name
      },
      confidence: Math.max(match.confidence || 0, 0.75),
      matchedBy: CLASSIFICATION_MATCHED_BY.SENDER_EMAIL
    };
  }

  async _loadProfiles(tenantId = null) {
    const query = tenantId ? { tenantId } : {};
    const profiles = await ApplicationProfile.find(query)
      .populate("applicationId", "code name isActive tenantId")
      .populate("modules.moduleId", "code name isActive applicationId")
      .lean();

    return profiles.filter((profile) => profile.applicationId?.isActive !== false);
  }

  async _enrichWithModuleKeywords(baseMatch, conversation, profiles, { preferSubject }) {
    const profile = moduleDetectionEngine.findProfileForApplication(
      profiles,
      baseMatch.application?.id
    );

    if (!profile) {
      return baseMatch;
    }

    const subjectModule = moduleDetectionEngine.detectByKeywords(conversation.subjectLower, profile, {
      matchedBy: CLASSIFICATION_MATCHED_BY.SUBJECT_KEYWORDS,
      maxConfidence: MATCH_CONFIDENCE.SUBJECT_KEYWORDS_MAX
    });

    const bodyModule =
      !subjectModule &&
      moduleDetectionEngine.detectByKeywords(conversation.bodyLower, profile, {
        matchedBy: CLASSIFICATION_MATCHED_BY.BODY_KEYWORDS,
        maxConfidence: MATCH_CONFIDENCE.BODY_KEYWORDS_MAX
      });

    const moduleMatch = preferSubject ? subjectModule || bodyModule : bodyModule || subjectModule;

    if (!moduleMatch?.module) {
      return baseMatch;
    }

    const combinedConfidence = Math.min(
      0.98,
      (baseMatch.confidence + moduleMatch.confidence) / 2 + 0.05
    );

    return {
      ...baseMatch,
      module: moduleMatch.module,
      confidence: combinedConfidence,
      matchedBy: moduleMatch.matchedBy
    };
  }

  async _attachModuleFromProfile(appMatch, textLower, profiles, matchedBy, maxConfidence) {
    const profile =
      profiles.find((item) => item._id.toString() === appMatch.profileId) ||
      moduleDetectionEngine.findProfileForApplication(profiles, appMatch.application?.id);

    if (!profile) {
      return appMatch;
    }

    const moduleMatch = moduleDetectionEngine.detectByKeywords(textLower, profile, {
      matchedBy,
      maxConfidence
    });

    if (!moduleMatch?.module) {
      return appMatch;
    }

    return {
      ...appMatch,
      module: moduleMatch.module,
      confidence: Math.min(0.98, (appMatch.confidence + moduleMatch.confidence) / 2 + 0.05),
      matchedBy: moduleMatch.matchedBy
    };
  }

  _finalize(candidate, profiles) {
    const threshold = this._resolveThreshold(candidate, profiles);
    const hasApplication = Boolean(candidate.application);
    const hasModule = Boolean(candidate.module);
    const meetsThreshold = candidate.confidence >= threshold;
    const requiresManualClassification =
      !hasApplication || !hasModule || !meetsThreshold;

    return buildDetectionResponse({
      isExistingTicket: candidate.isExistingTicket || false,
      existingTicket: candidate.existingTicket || null,
      application: candidate.application || null,
      module: candidate.module || null,
      confidence: candidate.confidence || 0,
      matchedBy: candidate.matchedBy || CLASSIFICATION_MATCHED_BY.MANUAL,
      requiresManualClassification,
      merchantId: candidate.merchantId || null,
      tenantId: candidate.tenantId || null,
      routingStatus:
        candidate.routingStatus ||
        (candidate.tenantId ? "RESOLVED" : requiresManualClassification ? "UNRESOLVED" : "RESOLVED"),
      routingReason: candidate.routingReason || null
    });
  }

  _resolveThreshold(candidate, profiles) {
    if (candidate.confidenceThreshold != null) {
      return candidate.confidenceThreshold;
    }

    const profile = moduleDetectionEngine.findProfileForApplication(
      profiles,
      candidate.application?.id
    );

    return profile?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  }
}

module.exports = new ClassificationEngine();
