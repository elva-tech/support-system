const {
  extractReplyBody,
  mapEmailAttachments,
  normalizeReferences
} = require("../../src/modules/email/email-content.util");

describe("email-content.util", () => {
  it("extracts only the new text from a Gmail-style reply", () => {
    const parsed = {
      text: "ok i will attach\n\nOn Sat, Jun 27, 2026 at 11:48 AM ELVA Support <support@elvatech.in> wrote:\n> please add attachments"
    };

    expect(extractReplyBody(parsed)).toBe("ok i will attach");
  });

  it("maps attachments even when filename is missing", () => {
    const parsed = {
      attachments: [
        {
          content: Buffer.from("hello"),
          contentType: "image/png",
          size: 5
        }
      ]
    };

    const attachments = mapEmailAttachments(parsed);
    expect(attachments).toHaveLength(1);
    expect(attachments[0].originalname).toMatch(/^attachment-1\.png$/);
    expect(attachments[0].buffer.toString()).toBe("hello");
  });

  it("normalizes reference headers from a string", () => {
    expect(normalizeReferences("<one@mail> <two@mail>")).toEqual([
      "<one@mail>",
      "<two@mail>"
    ]);
  });

  it("detects support@ only when that alias is a recipient", () => {
    const { isAddressedToSupport, collectRecipientAddresses } = require("../../src/modules/email/email-content.util");

    expect(
      isAddressedToSupport({
        to: { value: [{ address: "support@elvatech.in" }] }
      })
    ).toBe(true);

    expect(
      isAddressedToSupport({
        to: { value: [{ address: "hr@elvatech.in" }] }
      })
    ).toBe(false);

    expect(
      isAddressedToSupport({
        to: { value: [{ address: "tech.elva@gmail.com" }] },
        headers: new Map([["delivered-to", "support@elvatech.in"]])
      })
    ).toBe(true);

    expect(collectRecipientAddresses({
      to: { value: [{ address: "ceo@elvatech.in" }] },
      cc: { value: [{ address: "support@elvatech.in" }] }
    })).toEqual(new Set(["ceo@elvatech.in", "support@elvatech.in"]));
  });
});
