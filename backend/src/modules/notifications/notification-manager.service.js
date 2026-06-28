const env = require("../../config/env");
const NotificationEvent = require("./notification-event.model");
const deliveryService = require("./notification-delivery.service");
const { SmtpProvider, ResendProvider, ElvaNotifyProvider, FallbackProvider } = require("./providers");
const { NOTIFICATION_PROVIDERS } = require("../../shared/constants/notification-types");
const { isSmtpConfigured } = require("./smtp.config");
const { isResendConfigured } = require("./resend.config");
const { usesElvaNotifyNativeOtp } = require("./elva-notify.config");
const logger = require("../../shared/utils/logger");

class NotificationManager {
  constructor() {
    this.smtpProvider = new SmtpProvider();
    this.resendProvider = new ResendProvider();
    this.elvaNotifyProvider = new ElvaNotifyProvider();
    this.fallbackProvider = new FallbackProvider();
    this.fallbackEnabled = env.notifications.fallbackEnabled;
  }

  _emailProvider() {
    if (env.notifications.provider === "RESEND") {
      return this.resendProvider;
    }

    if (env.notifications.provider === "ELVA_NOTIFY" && !isSmtpConfigured() && !isResendConfigured()) {
      return this.elvaNotifyProvider;
    }

    return this.smtpProvider;
  }

  _emailProviderName() {
    if (env.notifications.provider === "RESEND") {
      return NOTIFICATION_PROVIDERS.RESEND;
    }

    if (env.notifications.provider === "ELVA_NOTIFY" && !isSmtpConfigured() && !isResendConfigured()) {
      return NOTIFICATION_PROVIDERS.ELVA_NOTIFY;
    }

    return NOTIFICATION_PROVIDERS.SMTP;
  }

  /**
   * Deliver OTP via SMTP (relay mode) or ELVA Notify (native mode), with log fallback.
   * OTP generation, storage, and verification remain in merchant.service for relay mode.
   */
  async sendOtp(payload) {
    if (usesElvaNotifyNativeOtp()) {
      return this._deliverWithFallback(
        this.elvaNotifyProvider,
        NOTIFICATION_PROVIDERS.ELVA_NOTIFY,
        "sendOtp",
        payload
      );
    }

    return this._deliverWithFallback(
      this._emailProvider(),
      this._emailProviderName(),
      "sendOtp",
      payload
    );
  }

  async verifyOtp(payload) {
    const primaryResult = await this._tryProvider(this.elvaNotifyProvider, "verifyOtp", payload);

    if (primaryResult.success) {
      await deliveryService.recordSuccess(NOTIFICATION_PROVIDERS.ELVA_NOTIFY);
      return { success: true, provider: NOTIFICATION_PROVIDERS.ELVA_NOTIFY };
    }

    await deliveryService.recordFailure(
      NOTIFICATION_PROVIDERS.ELVA_NOTIFY,
      primaryResult.error || "ELVA Notify OTP verification failed"
    );

    return { success: false, provider: NOTIFICATION_PROVIDERS.ELVA_NOTIFY, error: primaryResult.error };
  }

  async resendOtp(payload) {
    const primaryResult = await this._tryProvider(this.elvaNotifyProvider, "resendOtp", payload);

    if (primaryResult.success) {
      await deliveryService.recordSuccess(NOTIFICATION_PROVIDERS.ELVA_NOTIFY);
      return { success: true, provider: NOTIFICATION_PROVIDERS.ELVA_NOTIFY };
    }

    await deliveryService.recordFailure(
      NOTIFICATION_PROVIDERS.ELVA_NOTIFY,
      primaryResult.error || "ELVA Notify OTP resend failed"
    );

    return { success: false, provider: NOTIFICATION_PROVIDERS.ELVA_NOTIFY, error: primaryResult.error };
  }

  /**
   * Deliver a queued notification_event via SMTP with optional log fallback.
   * Marks the event processed after delivery attempt(s) complete.
   */
  async sendNotification(event) {
    const payload = event.deliveryPayload;
    const provider = this._emailProvider();
    const providerName = this._emailProviderName();

    const primaryResult = await this._tryProvider(provider, "sendNotification", payload);

    if (primaryResult.success) {
      await deliveryService.recordSuccess(providerName, event._id);
      await this._markEventProcessed(event._id);
      return { success: true, provider: providerName };
    }

    await deliveryService.recordFailure(
      providerName,
      primaryResult.error || "Email delivery failed",
      event._id
    );

    if (!this.fallbackEnabled) {
      await this._markEventProcessed(event._id);
      return { success: false, provider: providerName };
    }

    const fallbackResult = await this._tryProvider(
      this.fallbackProvider,
      "sendNotification",
      payload
    );

    if (fallbackResult.success) {
      await deliveryService.recordSuccess(NOTIFICATION_PROVIDERS.FALLBACK, event._id);
    } else {
      await deliveryService.recordFailure(
        NOTIFICATION_PROVIDERS.FALLBACK,
        fallbackResult.error || "Fallback delivery failed",
        event._id
      );
    }

    await this._markEventProcessed(event._id);
    return {
      success: fallbackResult.success,
      provider: NOTIFICATION_PROVIDERS.FALLBACK
    };
  }

  async sendEmail(payload) {
    const provider = this._emailProvider();
    const providerName = this._emailProviderName();
    const result = await this._tryProvider(provider, "sendEmail", payload);

    if (result.success) {
      await deliveryService.recordSuccess(providerName);
      return { ...result, provider: providerName };
    }

    await deliveryService.recordFailure(providerName, result.error || "Email delivery failed");

    if (!this.fallbackEnabled) {
      return { ...result, provider: providerName };
    }

    const fallbackResult = await this._tryProvider(this.fallbackProvider, "sendEmail", payload);

    if (fallbackResult.success) {
      await deliveryService.recordSuccess(NOTIFICATION_PROVIDERS.FALLBACK);
      return { ...fallbackResult, provider: NOTIFICATION_PROVIDERS.FALLBACK };
    }

    await deliveryService.recordFailure(
      NOTIFICATION_PROVIDERS.FALLBACK,
      fallbackResult.error || "Fallback email delivery failed"
    );

    return { ...fallbackResult, provider: NOTIFICATION_PROVIDERS.FALLBACK };
  }

  async _deliverWithFallback(provider, providerName, method, payload) {
    const primaryResult = await this._tryProvider(provider, method, payload);

    if (primaryResult.success) {
      await deliveryService.recordSuccess(providerName);
      return { success: true, provider: providerName };
    }

    await deliveryService.recordFailure(
      providerName,
      primaryResult.error || `${providerName} OTP delivery failed`
    );

    if (!this.fallbackEnabled) {
      logger.warn("OTP delivery failed and fallback is disabled", { email: payload.email });
      return { success: false, provider: providerName, error: primaryResult.error };
    }

    const fallbackResult = await this._tryProvider(this.fallbackProvider, method, payload);

    if (fallbackResult.success) {
      await deliveryService.recordSuccess(NOTIFICATION_PROVIDERS.FALLBACK);
      return { success: true, provider: NOTIFICATION_PROVIDERS.FALLBACK };
    }

    await deliveryService.recordFailure(
      NOTIFICATION_PROVIDERS.FALLBACK,
      fallbackResult.error || "Fallback OTP delivery failed"
    );

    return { success: false, provider: NOTIFICATION_PROVIDERS.FALLBACK, error: fallbackResult.error };
  }

  async _tryProvider(provider, method, payload) {
    try {
      return await provider[method](payload);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _markEventProcessed(eventId) {
    await NotificationEvent.findByIdAndUpdate(eventId, { processed: true });
  }
}

module.exports = new NotificationManager();
