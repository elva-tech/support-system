const classificationEngine = require("../classification/engines/classification.engine");
const classificationService = require("../classification/classification.service");
const inboundMailQueueService = require("../inbound-mail-queue/inbound-mail-queue.service");
const conversationService = require("../conversations/conversation.service");
const ticketService = require("../tickets/ticket.service");
const MerchantProfile = require("../merchants/merchant-profile.model");
const Ticket = require("../tickets/ticket.model");
const TicketConversation = require("../conversations/ticket-conversation.model");
const { CONVERSATION_SOURCES } = require("../../shared/constants/communication-channels");
const { SENDER_TYPES } = require("../../shared/constants/conversation-types");
const logger = require("../../shared/utils/logger");

/**
 * Unified omnichannel conversation engine.
 * All channels (PORTAL, EMAIL, API) pass through here before ticket/timeline changes.
 */
class OmnichannelConversationEngine {
  async processInbound(payload) {
    const source = payload.source || CONVERSATION_SOURCES.API;
    const normalized = {
      senderEmail: payload.senderEmail,
      senderName: payload.senderName || "",
      subject: payload.subject,
      body: payload.body || "",
      attachments: payload.attachments || [],
      channelMetadata: payload.channelMetadata || {},
      externalMessageId: payload.externalMessageId || payload.channelMetadata?.messageId || null
    };

    if (normalized.externalMessageId) {
      const existing = await TicketConversation.findOne({
        externalMessageId: normalized.externalMessageId
      });
      if (existing) {
        const ticket = await Ticket.findById(existing.ticketId);
        return {
          action: "DUPLICATE",
          ticketId: ticket?._id?.toString() || null,
          ticketNumber: ticket?.ticketNumber || null,
          conversationId: existing._id.toString()
        };
      }
    }

    const classification = await classificationEngine.classify({
      senderEmail: normalized.senderEmail,
      subject: normalized.subject,
      body: normalized.body,
      channelMetadata: normalized.channelMetadata
    });

    if (classification.isExistingTicket && classification.existingTicket?.id) {
      return this._appendToExistingTicket({
        ticketId: classification.existingTicket.id,
        source,
        normalized,
        classification
      });
    }

    if (!classification.requiresManualClassification && classification.application && classification.module) {
      return this._createNewTicket({ source, normalized, classification });
    }

    if (source === CONVERSATION_SOURCES.EMAIL) {
      return this._queueUnknownEmail(normalized, classification);
    }

    const queued = await classificationService.classifyConversation({
      senderEmail: normalized.senderEmail,
      subject: normalized.subject,
      body: normalized.body,
      enqueue: true
    });

    return {
      action: "QUEUED",
      queueItemId: queued.queueItemId,
      classification: queued
    };
  }

  async _appendToExistingTicket({ ticketId, source, normalized, classification }) {
    const ticket = await ticketService.getById(ticketId);
    const merchant = await MerchantProfile.findById(ticket.merchantId);

    const conversation = await conversationService.addReply(ticketId, {
      senderType: SENDER_TYPES.MERCHANT,
      senderId: merchant?._id || null,
      senderName: merchant?.merchantName || normalized.senderEmail,
      message:
        normalized.body ||
        (normalized.attachments?.length ? "Sent attachments via email" : normalized.subject),
      source,
      channelMetadata: normalized.channelMetadata,
      externalMessageId: normalized.externalMessageId,
      skipOutboundEmail: source === CONVERSATION_SOURCES.EMAIL
    });

    await this._attachFiles(ticket, conversation._id, normalized.attachments, merchant);

    logger.info("Inbound message appended to existing ticket", {
      ticketNumber: ticket.ticketNumber,
      source,
      matchedBy: classification.matchedBy
    });

    return {
      action: "REPLY",
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      conversationId: conversation._id.toString(),
      classification
    };
  }

  async _createNewTicket({ source, normalized, classification }) {
    let merchant = null;

    if (classification.merchantId) {
      merchant = await MerchantProfile.findById(classification.merchantId);
    }

    if (!merchant) {
      merchant = await MerchantProfile.findOne({
        email: normalized.senderEmail.toLowerCase(),
        applicationId: classification.application.id,
        isActive: true
      });
    }

    if (!merchant) {
      if (source === CONVERSATION_SOURCES.EMAIL) {
        return this._queueUnknownEmail(normalized, classification);
      }

      const queued = await classificationService.classifyConversation({
        senderEmail: normalized.senderEmail,
        subject: normalized.subject,
        body: normalized.body,
        enqueue: true
      });
      return { action: "QUEUED", queueItemId: queued.queueItemId, classification: queued };
    }

    const ticket = await ticketService.createFromChannel({
      merchant,
      moduleId: classification.module.id,
      subject: normalized.subject,
      description:
        normalized.body ||
        (normalized.attachments?.length ? "New support request with attachments via email" : normalized.subject),
      source,
      channelMetadata: normalized.channelMetadata
    });

    if (normalized.externalMessageId) {
      await TicketConversation.findOneAndUpdate(
        { ticketId: ticket._id },
        { externalMessageId: normalized.externalMessageId },
        { sort: { createdAt: 1 } }
      );
    }

    const firstConversation = await TicketConversation.findOne({ ticketId: ticket._id }).sort({
      createdAt: 1
    });
    await this._attachFiles(ticket, firstConversation?._id, normalized.attachments, merchant);

    logger.info("Inbound message created new ticket", {
      ticketNumber: ticket.ticketNumber,
      source,
      matchedBy: classification.matchedBy
    });

    return {
      action: "CREATED",
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      classification
    };
  }

  async _queueUnknownEmail(normalized, classification) {
    const item = await inboundMailQueueService.enqueueFromEmail({
      senderEmail: normalized.senderEmail,
      senderName: normalized.senderName,
      subject: normalized.subject,
      body: normalized.body,
      attachments: normalized.attachments,
      externalMessageId: normalized.externalMessageId,
      channelMetadata: normalized.channelMetadata
    });

    logger.info("Inbound email queued for admin review", {
      queueItemId: item._id.toString(),
      senderEmail: item.senderEmail
    });

    return {
      action: "QUEUED",
      queueType: "INBOUND_MAIL",
      queueItemId: item._id.toString(),
      classification
    };
  }

  async _attachFiles(ticket, conversationId, attachments, merchant) {
    if (!attachments?.length) return;

    const label = merchant ? `merchant:${merchant.merchantName}` : "merchant:Email Sender";

    for (const file of attachments) {
      await conversationService.uploadAttachment(ticket._id, file, label, conversationId);
    }
  }
}

module.exports = new OmnichannelConversationEngine();
