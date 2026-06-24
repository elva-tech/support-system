const env = require("../../../config/env");
const NotificationProvider = require("./notification-provider.base");
const { NOTIFICATION_PROVIDERS, OTP_CHANNELS } = require("../../../shared/constants/notification-types");
const { getElvaNotifyConfig, isElvaNotifyConfigured, usesElvaNotifyNativeOtp } = require("../elva-notify.config");

class ElvaNotifyProvider extends NotificationProvider {
  get name() {
    return NOTIFICATION_PROVIDERS.ELVA_NOTIFY;
  }

  /**
   * Native OTP: ELVA Notify generates and emails the code (/otp/send).
   * Relay OTP: Support system OTP is emailed via /notify HTML.
   */
  async sendOtp(payload) {
    if (!isElvaNotifyConfigured()) {
      return { success: false, error: "ELVA Notify is not fully configured (appId, apiKey, API URL)" };
    }

    if (usesElvaNotifyNativeOtp()) {
      return this._request("/otp/send", this._otpBody(payload));
    }

    if (!payload.otp) {
      return { success: false, error: "OTP relay mode requires a generated OTP code" };
    }

    return this._request(
      "/notify",
      this._notifyBody({
        to: [payload.email],
        subject: "Your ELVA Support verification code",
        html: `<p>Your ELVA Support verification code is <strong>${payload.otp}</strong>.</p><p>It expires in ${payload.expiresInMinutes} minutes.</p>`
      })
    );
  }

  async resendOtp(payload) {
    if (!isElvaNotifyConfigured()) {
      return { success: false, error: "ELVA Notify is not fully configured" };
    }

    if (!usesElvaNotifyNativeOtp()) {
      return { success: false, error: "OTP resend is only available in ELVA Notify native OTP mode" };
    }

    return this._request("/otp/resend", this._otpBody(payload));
  }

  async verifyOtp(payload) {
    if (!isElvaNotifyConfigured()) {
      return { success: false, error: "ELVA Notify is not fully configured" };
    }

    if (!usesElvaNotifyNativeOtp()) {
      return { success: false, error: "OTP verify via ELVA Notify is only available in native OTP mode" };
    }

    return this._request("/otp/verify", {
      ...this._otpBody(payload),
      otp: payload.otp
    });
  }

  async sendNotification(payload) {
    if (!isElvaNotifyConfigured()) {
      return { success: false, error: "ELVA Notify is not fully configured" };
    }

    const html = payload.html || `<p>${this._escapeHtml(payload.body)}</p>`;

    return this._request(
      "/notify",
      this._notifyBody({
        to: [payload.recipientEmail],
        subject: payload.subject,
        html
      })
    );
  }

  _otpBody(payload) {
    const body = {
      channel: this._normalizeChannel(payload.channel),
      email: payload.email
    };

    if (payload.phone) {
      body.phone = payload.phone;
    }

    return this._withCredentials(body, { includeBrandId: true });
  }

  _notifyBody({ to, subject, html }) {
    return this._withCredentials(
      {
        channel: "EMAIL",
        to,
        subject,
        html
      },
      { includeBrandId: false }
    );
  }

  _withCredentials(body, { includeBrandId }) {
    const { appId, apiKey, brandId } = getElvaNotifyConfig();
    const requestBody = {
      appId,
      apiKey,
      ...body
    };

    if (includeBrandId && brandId) {
      requestBody.brandId = brandId;
    }

    return requestBody;
  }

  _normalizeChannel(channel) {
    return String(channel || OTP_CHANNELS.EMAIL).toUpperCase() === OTP_CHANNELS.SMS.toUpperCase()
      ? "SMS"
      : "EMAIL";
  }

  _escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async _request(path, body) {
    const { apiUrl, timeoutMs } = getElvaNotifyConfig();

    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        success: false,
        error: `ELVA Notify responded with ${response.status}: ${errorBody || response.statusText}`
      };
    }

    const data = await response.json().catch(() => ({}));
    return {
      success: data.success !== false,
      messageId: data.messageId || data.id || data.requestId || null,
      data
    };
  }
}

module.exports = ElvaNotifyProvider;
