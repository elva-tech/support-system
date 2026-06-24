const env = require("../../config/env");
const NotificationEvent = require("./notification-event.model");
const deliveryService = require("./notification-delivery.service");
const { ElvaNotifyProvider, FallbackProvider } = require("./providers");
const { NOTIFICATION_PROVIDERS } = require("../../shared/constants/notification-types");
const logger = require("../../shared/utils/logger");

class NotificationManager {
  constructor() {
    this.primaryProvider = new ElvaNotifyProvider();
    this.fallbackProvider = new FallbackProvider();
    this.fallbackEnabled = env.notifications.fallbackEnabled;
  }

  /**
   * Deliver OTP via ELVA Notify, falling back to log-based provider on failure.
   * OTP generation, storage, and verification remain in merchant.service.
   */
  async sendOtp(payload) {
    const primaryResult = await this._tryProvider(this.primaryProvider, "sendOtp", payload);

    if (primaryResult.success) {
      await deliveryService.recordSuccess(NOTIFICATION_PROVIDERS.ELVA_NOTIFY);
      return { success: true, provider: NOTIFICATION_PROVIDERS.ELVA_NOTIFY };
    }

    await deliveryService.recordFailure(
      NOTIFICATION_PROVIDERS.ELVA_NOTIFY,
      primaryResult.error || "ELVA Notify OTP delivery failed"
    );

    if (!this.fallbackEnabled) {
      logger.warn("OTP delivery failed and fallback is disabled", { email: payload.email });
      return { success: false, provider: NOTIFICATION_PROVIDERS.ELVA_NOTIFY, error: primaryResult.error };
    }

    const fallbackResult = await this._tryProvider(this.fallbackProvider, "sendOtp", payload);

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

  async verifyOtp(payload) {
    const primaryResult = await this._tryProvider(this.primaryProvider, "verifyOtp", payload);

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
    const primaryResult = await this._tryProvider(this.primaryProvider, "resendOtp", payload);

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
   * Deliver a queued notification_event via ELVA Notify with optional fallback.
   * Marks the event processed after delivery attempt(s) complete.
   */
  async sendNotification(event) {
    const payload = event.deliveryPayload;

    const primaryResult = await this._tryProvider(
      this.primaryProvider,
      "sendNotification",
      payload
    );

    if (primaryResult.success) {
      await deliveryService.recordSuccess(NOTIFICATION_PROVIDERS.ELVA_NOTIFY, event._id);
      await this._markEventProcessed(event._id);
      return { success: true, provider: NOTIFICATION_PROVIDERS.ELVA_NOTIFY };
    }

    await deliveryService.recordFailure(
      NOTIFICATION_PROVIDERS.ELVA_NOTIFY,
      primaryResult.error || "ELVA Notify delivery failed",
      event._id
    );

    if (!this.fallbackEnabled) {
      await this._markEventProcessed(event._id);
      return { success: false, provider: NOTIFICATION_PROVIDERS.ELVA_NOTIFY };
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
