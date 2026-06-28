const env = require("../../config/env");

const mapEmailAttachments = (parsed) =>
  (parsed.attachments || [])
    .filter((att) => att.content && (att.content.length || att.size))
    .map((att, index) => {
      const ext = (att.contentType || "application/octet-stream").split("/")[1] || "bin";
      const filename = att.filename || `attachment-${index + 1}.${ext}`;

      return {
        originalname: filename,
        mimetype: att.contentType || "application/octet-stream",
        size: att.size || att.content.length,
        buffer: att.content
      };
    });

const extractReplyBody = (parsed) => {
  const text = String(parsed.text || "").replace(/\r\n/g, "\n").trim();
  if (text) {
    const gmailMatch = text.match(/^([\s\S]*?)\n\nOn .+ wrote:\n/i);
    if (gmailMatch?.[1]?.trim()) {
      return gmailMatch[1].trim();
    }

    const outlookSplit = text.split(/\n-{2,}\s*Original Message\s*-{2,}/i)[0];
    if (outlookSplit && outlookSplit.trim() !== text) {
      return outlookSplit.trim();
    }

    const lines = text.split("\n");
    const replyLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(">")) {
        break;
      }
      if (/^On .+ wrote:$/i.test(trimmed)) {
        break;
      }
      if (/^-{2,}\s*$/.test(trimmed) && replyLines.length) {
        break;
      }
      replyLines.push(line);
    }

    const stripped = replyLines.join("\n").trim();
    if (stripped) {
      return stripped;
    }
  }

  if (parsed.html) {
    return String(parsed.html)
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
};

const normalizeReferences = (references) => {
  if (!references) {
    return [];
  }

  if (Array.isArray(references)) {
    return references.filter(Boolean);
  }

  return String(references).match(/<[^>]+>/g) || [];
};

const collectRecipientAddresses = (parsed) => {
  const addresses = new Set();

  const add = (value) => {
    if (!value) return;
    const normalized = String(value).trim().toLowerCase();
    const match = normalized.match(/<?([^\s<>]+@[^\s<>]+)>?/);
    if (match?.[1]) {
      addresses.add(match[1]);
    }
  };

  for (const field of [parsed.to, parsed.cc, parsed.bcc]) {
    for (const entry of field?.value || []) {
      add(entry.address);
    }
  }

  const headers = parsed.headers;
  if (headers) {
    const headerKeys = [
      "delivered-to",
      "x-delivered-to",
      "x-original-to",
      "envelope-to",
      "x-envelope-to",
      "x-forwarded-to"
    ];

    for (const key of headerKeys) {
      const value = headers.get(key);
      if (!value) continue;

      const values = Array.isArray(value) ? value : [value];
      for (const raw of values) {
        add(raw);
      }
    }
  }

  return addresses;
};

const isAddressedToSupport = (parsed) => {
  const supportAddress = env.email.supportAddress.toLowerCase();
  if (collectRecipientAddresses(parsed).has(supportAddress)) {
    return true;
  }

  const headers = parsed.headers;
  if (headers) {
    const gmLabels = headers.get("x-gm-labels");
    if (gmLabels && String(gmLabels).toLowerCase().includes(supportAddress)) {
      return true;
    }
  }

  return false;
};

module.exports = {
  mapEmailAttachments,
  extractReplyBody,
  normalizeReferences,
  collectRecipientAddresses,
  isAddressedToSupport
};
