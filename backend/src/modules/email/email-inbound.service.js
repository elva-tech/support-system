const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const omnichannelEngine = require("../omnichannel/conversation-engine.service");
const emailThreadService = require("./email-thread.service");
const {
  mapEmailAttachments,
  extractReplyBody,
  normalizeReferences,
  isAddressedToSupport
} = require("./email-content.util");
const { CONVERSATION_SOURCES, EMAIL_DIRECTION } = require("../../shared/constants/communication-channels");

const isConfigured = () =>
  Boolean(
    env.email.inboundEnabled &&
      env.email.imap.host &&
      env.email.imap.user &&
      env.email.imap.password
  );

const isGmailHost = () => env.email.imap.host.toLowerCase().includes("gmail.com");

const createImapClient = () => {
  const client = new ImapFlow({
    host: env.email.imap.host,
    port: env.email.imap.port,
    secure: env.email.imap.secure,
    auth: {
      user: env.email.imap.user,
      pass: env.email.imap.password
    },
    logger: false,
    socketTimeout: 300000,
    greetingTimeout: 30000
  });

  client.on("error", (error) => {
    logger.warn("[IMAP] connection error", { error: error.message, code: error.code });
  });

  return client;
};

const resolveMailbox = async (client) => {
  const preferred = env.email.imap.mailbox || env.email.supportAddress;
  if (!preferred) {
    return { path: "INBOX", isSupportMailbox: false };
  }

  try {
    const mailboxes = await client.list();
    const normalizedPreferred = preferred.toLowerCase();

    const match = mailboxes.find((entry) => {
      const path = String(entry.path || "").toLowerCase();
      const name = String(entry.name || entry.path || "").toLowerCase();
      return path === normalizedPreferred || name === normalizedPreferred;
    });

    if (match) {
      return { path: match.path, isSupportMailbox: true };
    }
  } catch (error) {
    logger.warn("Could not list IMAP mailboxes — falling back to INBOX", { error: error.message });
  }

  return { path: "INBOX", isSupportMailbox: false };
};

const buildSearchQuery = (since, { isSupportMailbox }) => {
  if (isSupportMailbox) {
    return { since };
  }

  if (isGmailHost() && env.email.supportAddress) {
    return {
      since,
      labels: { has: [env.email.supportAddress] }
    };
  }

  return { since };
};

const processParsedEmail = async (parsed, imapUid, { requireSupportRecipient }) => {
  if (requireSupportRecipient && !isAddressedToSupport(parsed)) {
    return { action: "SKIPPED", reason: "NOT_SUPPORT_ALIAS" };
  }

  const fromAddress = parsed.from?.value?.[0]?.address || "";
  const senderName = parsed.from?.value?.[0]?.name || "";
  const messageId = parsed.messageId || `<imap-${imapUid}@local>`;

  if (await emailThreadService.findByMessageId(messageId)) {
    return { status: "DUPLICATE", messageId };
  }

  const replyBody = extractReplyBody(parsed);
  const attachments = mapEmailAttachments(parsed);
  const references = normalizeReferences(parsed.references);
  const inReplyTo = parsed.inReplyTo ? String(parsed.inReplyTo).trim() : null;

  const result = await omnichannelEngine.processInbound({
    source: CONVERSATION_SOURCES.EMAIL,
    senderEmail: fromAddress,
    senderName,
    subject: parsed.subject || "(No subject)",
    body:
      replyBody ||
      (attachments.length ? "Sent attachments via email" : parsed.subject || "(No message body)"),
    attachments,
    externalMessageId: messageId,
    channelMetadata: {
      messageId,
      inReplyTo,
      references,
      imapUid
    }
  });

  if (result.action === "REPLY" || result.action === "CREATED") {
    await emailThreadService.recordThreadMessage({
      ticketId: result.ticketId,
      conversationId: result.conversationId || null,
      messageId,
      inReplyTo,
      references,
      direction: EMAIL_DIRECTION.INBOUND,
      subject: parsed.subject || "",
      fromEmail: fromAddress,
      toEmail: env.email.supportAddress
    });
  }

  return result;
};

const pollInbox = async () => {
  if (!isConfigured()) {
    return { processed: 0, skipped: true };
  }

  const client = createImapClient();
  let processed = 0;
  let synced = 0;
  let ignored = 0;
  let skippedOtherAlias = 0;

  try {
    await client.connect();
    const { path: mailboxPath, isSupportMailbox } = await resolveMailbox(client);
    const lock = await client.getMailboxLock(mailboxPath);

    try {
      const since = new Date();
      since.setDate(since.getDate() - env.email.imap.lookbackDays);

      let uids = [];
      try {
        uids = await client.search(buildSearchQuery(since, { isSupportMailbox }), { uid: true });
      } catch (searchError) {
        logger.warn("Gmail label search failed — retrying with date-only search", {
          error: searchError.message,
          mailbox: mailboxPath
        });
        uids = await client.search({ since }, { uid: true });
      }

      const batch = uids.sort((a, b) => b - a).slice(0, env.email.imap.batchSize);

      if (!batch.length) {
        logger.info("Email inbox poll complete", {
          processed: 0,
          synced: 0,
          ignored: 0,
          skippedOtherAlias: 0,
          mailbox: mailboxPath
        });
        return { processed: 0, synced: 0, ignored: 0, skippedOtherAlias: 0, skipped: false };
      }

      for await (const message of client.fetch(batch, { source: true, uid: true }, { uid: true })) {
        if (!message.source) {
          continue;
        }

        try {
          const parsed = await simpleParser(message.source);
          const result = await processParsedEmail(parsed, message.uid, {
            requireSupportRecipient: !isSupportMailbox
          });

          if (result.action === "SKIPPED" && result.reason === "NOT_SUPPORT_ALIAS") {
            skippedOtherAlias += 1;
            continue;
          }

          await client.messageFlagsAdd(message.uid, ["\\Seen"]);
          processed += 1;

          if (result.action === "REPLY" || result.action === "CREATED") {
            synced += 1;
            logger.info("Inbound support email synced", {
              action: result.action,
              ticketNumber: result.ticketNumber || null,
              subject: parsed.subject
            });
          } else if (result.action === "QUEUED" || result.status === "DUPLICATE") {
            ignored += 1;
          }
        } catch (messageError) {
          logger.warn("Failed to process inbound email message", {
            uid: message.uid,
            error: messageError.message
          });
        }
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    logger.error("Email inbound poll failed", { error: error.message, code: error.code });
    throw error;
  } finally {
    await client.logout().catch(() => {});
  }

  logger.info("Email inbox poll complete", {
    processed,
    synced,
    ignored,
    skippedOtherAlias,
    supportAddress: env.email.supportAddress
  });

  return { processed, synced, ignored, skippedOtherAlias, skipped: false };
};

module.exports = { isConfigured, pollInbox, processParsedEmail };
