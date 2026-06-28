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
  merchantId = null
}) => ({
  isExistingTicket,
  existingTicket,
  application,
  module,
  confidence: Number(confidence.toFixed(4)),
  matchedBy,
  requiresManualClassification,
  ...(merchantId && { merchantId })
});

/**
 * Orchestrates classification before ticket processing.
 *
 * Detection order:
 * 1. Ticket reference
 * 2. Sender email
 * 3. Subject keywords (application + module)
 * 4. Body keywords (application + module)
 * 5. Manual classification required
 */
class ClassificationEngine {
  async classify(input = {}) {
    const conversation = conversationEngine.parse(input);
    const profiles = await this._loadProfiles();
    const channelMetadata = input.channelMetadata || {};

    // 1. Email thread headers (In-Reply-To / References)
    const threadMatch = await applicationDetectionEngine.detectByEmailThread(
      channelMetadata.inReplyTo,
      channelMetadata.references
    );
    if (threadMatch) {
      return buildDetectionResponse({
        ...threadMatch,
        requiresManualClassification: false
      });
    }

    // 2. Ticket reference in subject/body — existing ticket
    const ticketMatch = await applicationDetectionEngine.detectByTicketReference(
      conversation.ticketReference
    );
    if (ticketMatch) {
      return buildDetectionResponse({
        ...ticketMatch,
        requiresManualClassification: false
      });
    }

    // 3. Sender email — application from merchant
    const senderMatch = await applicationDetectionEngine.detectBySenderEmail(conversation.senderEmail);
    if (senderMatch) {
      const enriched = await this._enrichWithModuleKeywords(senderMatch, conversation, profiles, {
        preferSubject: true
      });
      const withDefaultModule = enriched.module
        ? enriched
        : await this._applyDefaultModule(enriched);
      return this._finalize(withDefaultModule, profiles);
    }

    // 4. Subject keywords
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
      return this._finalize(withModule, profiles);
    }

    // 5. Body keywords
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
      return this._finalize(withModule, profiles);
    }

    // 6. Manual classification
    return buildDetectionResponse({
      matchedBy: CLASSIFICATION_MATCHED_BY.MANUAL,
      requiresManualClassification: true,
      confidence: 0
    });
  }

  async _applyDefaultModule(match) {
    if (!match.application?.id || match.module) {
      return match;
    }

    const moduleDoc = await Module.findOne({
      applicationId: match.application.id,
      isActive: true
    })
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

  async _loadProfiles() {
    const profiles = await ApplicationProfile.find()
      .populate("applicationId", "code name isActive")
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
      merchantId: candidate.merchantId || null
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
