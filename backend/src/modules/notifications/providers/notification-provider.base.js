/**
 * @typedef {Object} OtpPayload
 * @property {string} email
 * @property {string} [phone]
 * @property {string} otp
 * @property {'email'|'sms'} channel
 * @property {number} expiresInMinutes
 */

/**
 * @typedef {Object} NotificationPayload
 * @property {string} eventType
 * @property {string} recipientEmail
 * @property {string} [recipientPhone]
 * @property {string} subject
 * @property {string} body
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} ProviderResult
 * @property {boolean} success
 * @property {string} [messageId]
 * @property {string} [error]
 */

/**
 * Base contract for notification providers.
 * Implementations: SmtpProvider, ElvaNotifyProvider, FallbackProvider
 * Future: Fast2SMS, MSG91, Gupshup
 */
class NotificationProvider {
  /**
   * @returns {string}
   */
  get name() {
    throw new Error("Provider must implement name getter");
  }

  /**
   * @param {OtpPayload} _payload
   * @returns {Promise<ProviderResult>}
   */
  async sendOtp(_payload) {
    throw new Error("Provider must implement sendOtp()");
  }

  /**
   * @param {NotificationPayload} _payload
   * @returns {Promise<ProviderResult>}
   */
  async sendNotification(_payload) {
    throw new Error("Provider must implement sendNotification()");
  }
}

module.exports = NotificationProvider;
