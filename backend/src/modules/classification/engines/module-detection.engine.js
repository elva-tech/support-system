const Module = require("../../modules/module.model");
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

const toModuleRef = (moduleDoc) =>
  moduleDoc
    ? {
        id: moduleDoc._id.toString(),
        code: moduleDoc.code,
        name: moduleDoc.name
      }
    : null;

/**
 * Detects module from subject/body keywords within an application profile.
 */
class ModuleDetectionEngine {
  detectByKeywords(textLower, profile, { matchedBy, maxConfidence }) {
    if (!textLower || !profile?.modules?.length) {
      return null;
    }

    let best = null;

    for (const moduleEntry of profile.modules) {
      const { hits, matchedKeywords } = countKeywordHits(textLower, moduleEntry.keywords);
      if (!hits) continue;

      const confidence = scoreKeywordMatch(hits, moduleEntry.keywords.length, maxConfidence);
      const candidate = {
        module: moduleEntry.moduleId
          ? {
              id: moduleEntry.moduleId._id?.toString() || moduleEntry.moduleId.toString(),
              code: moduleEntry.moduleId.code,
              name: moduleEntry.moduleId.name
            }
          : null,
        confidence,
        matchedBy,
        matchedKeywords
      };

      if (!best || candidate.confidence > best.confidence) {
        best = candidate;
      }
    }

    return best;
  }

  async resolveModuleForApplication(applicationId, moduleHint) {
    if (moduleHint?.id) {
      const moduleDoc = await Module.findOne({
        _id: moduleHint.id,
        applicationId,
        isActive: true
      }).select("code name");

      return toModuleRef(moduleDoc);
    }

    return null;
  }

  findProfileForApplication(profiles, applicationId) {
    const appId = applicationId?.toString?.() || applicationId;
    return profiles.find((profile) => profile.applicationId?._id?.toString() === appId);
  }
}

module.exports = new ModuleDetectionEngine();
