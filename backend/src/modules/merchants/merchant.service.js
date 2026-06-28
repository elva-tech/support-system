const ApiError = require("../../shared/utils/ApiError");
const MerchantProfile = require("./merchant-profile.model");
const OtpSession = require("./otp-session.model");
const MerchantSession = require("./merchant-session.model");
const Application = require("../applications/application.model");
const { generateOtp, generateSessionToken, hashValue } = require("../../shared/utils/token.util");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const env = require("../../config/env");
const { usesElvaNotifyNativeOtp } = require("../notifications/elva-notify.config");
const onboardingEmail = require("../notifications/onboarding-email.service");
const logger = require("../../shared/utils/logger");

const OTP_EXPIRY_MS = env.otpExpiresMinutes * 60 * 1000;
const OTP_VERIFY_FAILURE_MESSAGE = "Invalid email or OTP code";

const otpSentResponse = (extra = {}) => ({
  sent: true,
  message: "A verification code has been sent to your email. It may take a minute to arrive.",
  expiresInMinutes: env.otpExpiresMinutes,
  ...extra
});

const otpNotSentResponse = (message) => ({
  sent: false,
  message
});

const findActiveMerchantByEmail = async (email, { silent = false } = {}) => {
  const merchant = await MerchantProfile.findOne({ email: email.toLowerCase() });

  if (!merchant) {
    if (silent) {
      return null;
    }
    throw new ApiError(404, "No merchant account found for this email");
  }

  if (!merchant.isActive) {
    if (silent) {
      return null;
    }
    throw new ApiError(403, "Merchant account is inactive");
  }

  return merchant;
};

const requestOtp = async (email) => {
  const normalizedEmail = email.toLowerCase();

  const lockedSession = await OtpSession.findOne({
    email: normalizedEmail,
    lockedUntil: { $gt: new Date() }
  });

  if (lockedSession) {
    return otpNotSentResponse(
      "Too many failed attempts. Please wait a few minutes before requesting a new code."
    );
  }

  const merchant = await findActiveMerchantByEmail(normalizedEmail, { silent: true });
  if (!merchant) {
    logger.info("OTP not sent — no active merchant profile for email", { email: normalizedEmail });
    return otpNotSentResponse(
      "No merchant account was found for this email. Please use your registered business email or contact support."
    );
  }

  await OtpSession.deleteMany({ email: normalizedEmail, verified: false });

  const nativeOtp = usesElvaNotifyNativeOtp();
  const otp = nativeOtp ? null : generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await OtpSession.create({
    email: normalizedEmail,
    otpCode: nativeOtp ? "EXTERNAL" : hashValue(otp),
    expiresAt,
    verified: false,
    attemptCount: 0,
    lockedUntil: null,
    usesExternalOtp: nativeOtp
  });

  const notificationManager = require("../notifications/notification-manager.service");
  const { OTP_CHANNELS } = require("../../shared/constants/notification-types");

  const delivery = await notificationManager.sendOtp({
    email: normalizedEmail,
    phone: merchant.phone || null,
    otp,
    channel: OTP_CHANNELS.EMAIL,
    expiresInMinutes: env.otpExpiresMinutes
  });

  if (!delivery.success) {
    await OtpSession.deleteMany({ email: normalizedEmail, verified: false });
    logger.warn("OTP delivery failed", {
      email: normalizedEmail,
      provider: delivery.provider,
      error: delivery.error
    });
    throw new ApiError(
      503,
      "We could not send the verification email right now. Please try again in a few minutes."
    );
  }

  logger.info("OTP delivery accepted", {
    email: normalizedEmail,
    provider: delivery.provider,
    viaFallback: delivery.provider === "FALLBACK"
  });

  return otpSentResponse({
    ...(env.exposeOtpInResponse && otp && { otp })
  });
};

const verifyOtp = async (email, otpCode, sessionMeta = {}) => {
  const normalizedEmail = email.toLowerCase();

  const merchant = await findActiveMerchantByEmail(normalizedEmail, { silent: true });
  if (!merchant) {
    throw new ApiError(400, OTP_VERIFY_FAILURE_MESSAGE);
  }

  const session = await OtpSession.findOne({
    email: normalizedEmail,
    verified: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!session) {
    throw new ApiError(400, OTP_VERIFY_FAILURE_MESSAGE);
  }

  if (session.lockedUntil && session.lockedUntil > new Date()) {
    throw new ApiError(400, OTP_VERIFY_FAILURE_MESSAGE);
  }

  if (session.usesExternalOtp) {
    const notificationManager = require("../notifications/notification-manager.service");
    const { OTP_CHANNELS } = require("../../shared/constants/notification-types");
    const verifyResult = await notificationManager.verifyOtp({
      email: normalizedEmail,
      otp: otpCode,
      channel: OTP_CHANNELS.EMAIL
    });

    if (!verifyResult.success) {
      session.attemptCount += 1;

      if (session.attemptCount >= env.otpMaxAttempts) {
        session.lockedUntil = new Date(Date.now() + env.otpLockMinutes * 60 * 1000);
      }

      await session.save();
      throw new ApiError(400, OTP_VERIFY_FAILURE_MESSAGE);
    }
  } else if (session.otpCode !== hashValue(otpCode)) {
    session.attemptCount += 1;

    if (session.attemptCount >= env.otpMaxAttempts) {
      session.lockedUntil = new Date(Date.now() + env.otpLockMinutes * 60 * 1000);
    }

    await session.save();
    throw new ApiError(400, OTP_VERIFY_FAILURE_MESSAGE);
  }

  session.verified = true;
  await session.save();

  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.merchantSessionExpiresMs);

  await MerchantSession.create({
    merchantId: merchant._id,
    sessionToken: hashValue(sessionToken),
    expiresAt,
    lastAccessedAt: new Date(),
    ipAddress: sessionMeta.ipAddress || null,
    userAgent: sessionMeta.userAgent || null
  });

  const profile = await MerchantProfile.findById(merchant._id).populate(
    "applicationId",
    "name code"
  );

  await logAudit({
    entityType: ENTITY_TYPES.MERCHANT,
    entityId: merchant._id,
    action: AUDIT_ACTIONS.MERCHANT_LOGIN,
    actorType: ACTOR_TYPES.MERCHANT,
    actorId: merchant._id,
    actorName: merchant.merchantName,
    metadata: { email: merchant.email }
  });

  return {
    sessionToken,
    expiresAt,
    merchant: profile
  };
};

const getProfile = async (merchantId) => {
  const merchant = await MerchantProfile.findById(merchantId).populate(
    "applicationId",
    "name code"
  );

  if (!merchant) {
    throw new ApiError(404, "Merchant not found");
  }

  return merchant;
};

const logout = async (sessionToken) => {
  await MerchantSession.deleteOne({ sessionToken: hashValue(sessionToken) });
};

const validateSession = async (sessionToken, sessionMeta = {}) => {
  const session = await MerchantSession.findOne({
    sessionToken: hashValue(sessionToken),
    expiresAt: { $gt: new Date() }
  }).populate({
    path: "merchantId",
    populate: { path: "applicationId", select: "name code" }
  });

  if (!session || !session.merchantId?.isActive) {
    throw new ApiError(401, "Invalid or expired merchant session");
  }

  session.lastAccessedAt = new Date();
  if (sessionMeta.ipAddress) {
    session.ipAddress = sessionMeta.ipAddress;
  }
  if (sessionMeta.userAgent) {
    session.userAgent = sessionMeta.userAgent;
  }
  await session.save();

  return session.merchantId;
};

const syncMerchant = async (data) => {
  const application = await Application.findOne({
    code: data.applicationCode.toUpperCase(),
    isActive: true
  });

  if (!application) {
    throw new ApiError(400, `Application not found: ${data.applicationCode}`);
  }

  const email = data.email.toLowerCase();
  const existingByEmail = await MerchantProfile.findOne({ email });

  if (
    existingByEmail &&
    (existingByEmail.applicationId.toString() !== application._id.toString() ||
      existingByEmail.externalUserId !== data.externalUserId)
  ) {
    throw new ApiError(409, "Email already registered to another merchant");
  }

  const merchant = await MerchantProfile.findOneAndUpdate(
    {
      applicationId: application._id,
      externalUserId: data.externalUserId
    },
    {
      applicationId: application._id,
      applicationCode: application.code,
      externalUserId: data.externalUserId,
      merchantName: data.merchantName,
      email,
      phone: data.phone || "",
      isActive: data.isActive !== undefined ? data.isActive : true
    },
    { new: true, upsert: true, runValidators: true }
  ).populate("applicationId", "name code");

  return merchant;
};

const merchantPopulate = [{ path: "applicationId", select: "name code" }];

const listMerchants = async (filters = {}) => {
  const query = {};

  if (filters.applicationId) {
    query.applicationId = filters.applicationId;
  }

  if (filters.search) {
    query.$or = [
      { email: { $regex: filters.search, $options: "i" } },
      { merchantName: { $regex: filters.search, $options: "i" } }
    ];
  }

  return MerchantProfile.find(query).populate(merchantPopulate).sort({ createdAt: -1 });
};

const buildExternalUserId = (email) => `portal-${email.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const createByAdmin = async ({ applicationId, email, merchantName, phone, isActive = true }) => {
  const application = await Application.findById(applicationId);

  if (!application || !application.isActive) {
    throw new ApiError(400, "Invalid or inactive application");
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await MerchantProfile.findOne({ email: normalizedEmail });

  if (existing) {
    throw new ApiError(409, "A merchant with this email already exists");
  }

  const merchant = await syncMerchant({
    applicationCode: application.code,
    externalUserId: buildExternalUserId(normalizedEmail),
    merchantName: merchantName?.trim() || normalizedEmail.split("@")[0],
    email: normalizedEmail,
    phone: phone || "",
    isActive
  });

  await onboardingEmail.sendMerchantWelcomeEmail(merchant, application);

  return merchant;
};

const updateByAdmin = async (id, data) => {
  const merchant = await MerchantProfile.findById(id);

  if (!merchant) {
    throw new ApiError(404, "Merchant not found");
  }

  if (data.applicationId && data.applicationId !== merchant.applicationId.toString()) {
    const application = await Application.findById(data.applicationId);

    if (!application || !application.isActive) {
      throw new ApiError(400, "Invalid or inactive application");
    }

    merchant.applicationId = application._id;
    merchant.applicationCode = application.code;
  }

  if (data.email && data.email.toLowerCase() !== merchant.email) {
    const normalizedEmail = data.email.toLowerCase();
    const existing = await MerchantProfile.findOne({ email: normalizedEmail });

    if (existing) {
      throw new ApiError(409, "A merchant with this email already exists");
    }

    merchant.email = normalizedEmail;
    merchant.externalUserId = buildExternalUserId(normalizedEmail);
  }

  if (data.merchantName !== undefined) {
    merchant.merchantName = data.merchantName.trim();
  }

  if (data.phone !== undefined) {
    merchant.phone = data.phone;
  }

  if (data.isActive !== undefined) {
    merchant.isActive = data.isActive;
  }

  await merchant.save();
  return MerchantProfile.findById(id).populate(merchantPopulate);
};

module.exports = {
  requestOtp,
  verifyOtp,
  getProfile,
  logout,
  validateSession,
  syncMerchant,
  listMerchants,
  createByAdmin,
  updateByAdmin
};
