const {
  renderOtpEmail,
  renderNotificationEmail,
  renderTicketCreatedEmail,
  renderTicketAssignedEmail,
  renderTicketClosedEmail,
  buildTicketAssignmentHtml,
  escapeHtml
} = require("../../src/modules/notifications/email-templates");

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

  it("renders ticket created email with agent assignment", () => {
    const html = renderTicketCreatedEmail({
      ticketNumber: "APN-2026-000001",
      subject: "CMS issue",
      merchantName: "Arun",
      message: "Login issue in CMS",
      senderName: "Arun P N",
      ticket: { assignedTo: { firstName: "Arun", lastName: "Agent 2" } }
    });

    expect(html).toContain("Ticket created");
    expect(html).toContain("assigned to");
    expect(html).toContain("Arun Agent 2");
    expect(html).toContain("Login issue in CMS");
  });

  it("renders ticket created email when agents are busy", () => {
    const html = renderTicketCreatedEmail({
      ticketNumber: "APN-2026-000002",
      subject: "CMS issue",
      merchantName: "Arun",
      message: "Help",
      senderName: "Arun",
      ticket: { assignedTo: null }
    });

    expect(html).toContain("all our agents are busy");
    expect(html).toContain("team lead queue");
  });

  it("renders ticket assigned email", () => {
    const html = renderTicketAssignedEmail({
      ticketNumber: "APN-2026-000004",
      subject: "CMS issue",
      merchantName: "Arun",
      agentName: "Arun Agent 2"
    });

    expect(html).toContain("Ticket assigned");
    expect(html).toContain("Arun Agent 2");
  });

  it("renders ticket closed email with closure notes", () => {
    const html = renderTicketClosedEmail({
      ticketNumber: "APN-2026-000003",
      subject: "CMS issue",
      merchantName: "Arun",
      closureNotes: "Issue resolved after CMS cache clear."
    });

    expect(html).toContain("Ticket closed");
    expect(html).toContain("Closure notes");
    expect(html).toContain("Issue resolved after CMS cache clear.");
    expect(html).toContain("reply to this email");
  });
});
