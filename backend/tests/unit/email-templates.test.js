const { renderOtpEmail, renderNotificationEmail, escapeHtml } = require("../../src/modules/notifications/email-templates");

describe("email templates", () => {
  it("renders OTP email with branded layout and code", () => {
    const html = renderOtpEmail({ otp: "123456", expiresInMinutes: 10 });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Verify your email address");
    expect(html).toContain("ELVA Support");
    expect(html).toContain("123456");
    expect(html).toContain("10 minutes");
  });

  it("escapes HTML in notification body", () => {
    const html = renderNotificationEmail({
      subject: "Ticket update",
      body: '<script>alert("x")</script>',
      merchantName: "Acme & Co"
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("Acme &amp; Co");
  });

  it("escapeHtml encodes special characters", () => {
    expect(escapeHtml(`<a href="x">`)).toBe("&lt;a href=&quot;x&quot;&gt;");
  });
});
