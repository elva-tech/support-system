const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const { processParsedEmail } = require("./email-inbound-processor.service");

let activeClient = null;

const isConfigured = () =>
  Boolean(
    env.email.inboundEnabled &&
      env.email.inboundProvider === "imap" &&
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
    connectionTimeout: env.email.imap.connectionTimeoutMs,
    greetingTimeout: env.email.imap.greetingTimeoutMs,
    socketTimeout: env.email.imap.socketTimeoutMs,
    disableAutoIdle: true
  });

  client.on("error", (error) => {
    logger.warn("[IMAP] connection error", { error: error.message, code: error.code });
  });

  return client;
};

const releaseClient = async (client) => {
  try {
    if (client && !client.closed) {
      await client.logout();
    }
  } catch {
    try {
      client?.close();
    } catch {
      // ignore cleanup errors
    }
  } finally {
    if (activeClient === client) {
      activeClient = null;
    }
  }
};

const forceCloseActiveClient = async () => {
  const client = activeClient;
  if (!client) {
    return;
  }

  logger.warn("[IMAP] Forcing close on stuck poll connection");
  try {
    client.close();
  } catch {
    // ignore
  }

  activeClient = null;
};

const resolveMailbox = async (client) => {
  const preferred = env.email.imap.mailbox || env.email.supportAddress;

  // Gmail labels are unreliable as IMAP mailboxes — use INBOX + recipient filter.
  if (isGmailHost()) {
    return { path: "INBOX", isSupportMailbox: false };
  }

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

const buildSearchQuery = (since) => ({
  since,
  unseen: true
});

const pollInbox = async () => {
  if (!isConfigured()) {
    return { processed: 0, skipped: true };
  }

  const client = createImapClient();
  activeClient = client;
  let processed = 0;
  let synced = 0;
  let ignored = 0;
  let skippedOtherAlias = 0;

  try {
    await client.connect();
    const { path: mailboxPath } = await resolveMailbox(client);
    const lock = await client.getMailboxLock(mailboxPath);

    try {
      const since = new Date();
      since.setDate(since.getDate() - env.email.imap.lookbackDays);

      const uids = await client.search(buildSearchQuery(since), { uid: true });
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
            requireSupportRecipient: true
          });

          if (result.action === "SKIPPED" && result.reason === "NOT_SUPPORT_ALIAS") {
            skippedOtherAlias += 1;
            await client.messageFlagsAdd(message.uid, ["\\Seen"]);
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
    await releaseClient(client);
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

module.exports = {
  isConfigured,
  pollInbox,
  forceCloseActiveClient
};
