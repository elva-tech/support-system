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
const { INBOUND_MAIL_ROUTING_STATUS } = require("../../shared/constants/inbound-mail-queue");
const {
  loadTenantById,
  isTenantOperable,
  toIdString
} = require("../../shared/utils/tenant-ops.util");
const logger = require("../../shared/utils/logger");

/**
 * Unified omnichannel conversation engine.
 * All channels (PORTAL, EMAIL, API) pass through here before ticket/timeline changes.
 * Tenant identity travels with classification / ticket ownership — never guessed from HTTP.
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
        const ticket = await Ticket.findById(existing.ticketId).select("ticketNumber tenantId");
        return {
          action: "DUPLICATE",
          ticketId: ticket?._id?.toString() || null,
          ticketNumber: ticket?.ticketNumber || null,
          conversationId: existing._id.toString(),
          tenantId: ticket?.tenantId ? ticket.tenantId.toString() : null
        };
      }
    }

    const classification = await classificationEngine.classify({
      senderEmail: normalized.senderEmail,
      subject: normalized.subject,
      body: normalized.body,
      channelMetadata: normalized.channelMetadata,
      tenantId: payload.tenantId || null
    });

    if (
      classification.routingStatus === INBOUND_MAIL_ROUTING_STATUS.AMBIGUOUS ||
      classification.matchedBy === "AMBIGUOUS_SENDER" ||
      classification.matchedBy === "AMBIGUOUS_TICKET_REFERENCE"
    ) {
      return this._queueUnknownEmail(normalized, classification, {
        routingStatus: INBOUND_MAIL_ROUTING_STATUS.AMBIGUOUS,
        routingReason: classification.routingReason || "AMBIGUOUS_TENANT_ROUTING"
      });
    }

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
      return this._queueUnknownEmail(normalized, classification, {
        routingStatus: classification.routingStatus || INBOUND_MAIL_ROUTING_STATUS.UNRESOLVED,
        routingReason: classification.routingReason || "REQUIRES_MANUAL_CLASSIFICATION"
      });
    }

    const queued = await classificationService.classifyConversation({
      senderEmail: normalized.senderEmail,
      subject: normalized.subject,
      body: normalized.body,
      channelMetadata: normalized.channelMetadata,
      tenantId: classification.tenantId || null,
      enqueue: true
    });

    return {
      action: "QUEUED",
      queueItemId: queued.queueItemId,
      classification: queued,
      tenantId: classification.tenantId || null
    };
  }

  async _appendToExistingTicket({ ticketId, source, normalized, classification }) {
    const ticket = await ticketService.getById(ticketId);
    const tenantId = ticket.tenantId || classification.tenantId || null;

    if (tenantId) {
      const tenant = await loadTenantById(tenantId);
      if (tenant && !isTenantOperable(tenant)) {
        return this._queueUnknownEmail(normalized, classification, {
          tenantId,
          routingStatus: INBOUND_MAIL_ROUTING_STATUS.FAILED,
          routingReason: `TENANT_${tenant.status}_NOT_OPERABLE`
        });
      }
    }

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
      tenantId: toIdString(tenantId),
      source,
      matchedBy: classification.matchedBy
    });

    return {
      action: "REPLY",
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      conversationId: conversation._id.toString(),
      tenantId: toIdString(tenantId),
      classification
    };
  }

  async _createNewTicket({ source, normalized, classification }) {
    const tenantId = classification.tenantId || null;

    if (tenantId) {
      const tenant = await loadTenantById(tenantId);
      if (tenant && !isTenantOperable(tenant)) {
        return this._queueUnknownEmail(normalized, classification, {
          tenantId,
          routingStatus: INBOUND_MAIL_ROUTING_STATUS.FAILED,
          routingReason: `TENANT_${tenant.status}_NOT_OPERABLE`
        });
      }
    }

    let merchant = null;

    if (classification.merchantId) {
      merchant = await MerchantProfile.findById(classification.merchantId);
    }

    if (!merchant) {
      const merchantQuery = {
        email: normalized.senderEmail.toLowerCase(),
        applicationId: classification.application.id,
        isActive: true
      };
      if (tenantId) {
        merchantQuery.tenantId = tenantId;
      }
      merchant = await MerchantProfile.findOne(merchantQuery);
    }

    if (merchant && tenantId && merchant.tenantId && toIdString(merchant.tenantId) !== toIdString(tenantId)) {
      return this._queueUnknownEmail(normalized, classification, {
        routingStatus: INBOUND_MAIL_ROUTING_STATUS.AMBIGUOUS,
        routingReason: "MERCHANT_TENANT_MISMATCH"
      });
    }

    if (!merchant) {
      if (source === CONVERSATION_SOURCES.EMAIL) {
        return this._queueUnknownEmail(normalized, classification, {
          tenantId,
          routingStatus: tenantId
            ? INBOUND_MAIL_ROUTING_STATUS.RESOLVED
            : INBOUND_MAIL_ROUTING_STATUS.UNRESOLVED,
          routingReason: "MERCHANT_NOT_FOUND"
        });
      }

      const queued = await classificationService.classifyConversation({
        senderEmail: normalized.senderEmail,
        subject: normalized.subject,
        body: normalized.body,
        channelMetadata: normalized.channelMetadata,
        tenantId,
        enqueue: true
      });
      return { action: "QUEUED", queueItemId: queued.queueItemId, classification: queued, tenantId };
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

    await this._attachFiles(ticket, null, normalized.attachments, merchant);

    logger.info("Inbound message created new ticket", {
      ticketNumber: ticket.ticketNumber,
      tenantId: toIdString(ticket.tenantId),
      source,
      matchedBy: classification.matchedBy
    });

    return {
      action: "CREATED",
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      tenantId: toIdString(ticket.tenantId),
      classification
    };
  }

  async _queueUnknownEmail(normalized, classification, routing = {}) {
    const item = await inboundMailQueueService.enqueueFromEmail({
      senderEmail: normalized.senderEmail,
      senderName: normalized.senderName,
      subject: normalized.subject,
      body: normalized.body,
      attachments: normalized.attachments,
      externalMessageId: normalized.externalMessageId,
      channelMetadata: {
        ...normalized.channelMetadata,
        classificationMatchedBy: classification?.matchedBy || null,
        classificationConfidence: classification?.confidence ?? null
      },
      tenantId: routing.tenantId || classification?.tenantId || null,
      routingStatus: routing.routingStatus || INBOUND_MAIL_ROUTING_STATUS.UNRESOLVED,
      routingReason: routing.routingReason || classification?.routingReason || null
    });

    logger.info("Inbound email queued for admin review", {
      queueItemId: item._id.toString(),
      senderEmail: item.senderEmail,
      tenantId: item.tenantId ? item.tenantId.toString() : null,
      routingStatus: item.routingStatus
    });

    return {
      action: "QUEUED",
      queueType: "INBOUND_MAIL",
      queueItemId: item._id.toString(),
      tenantId: item.tenantId ? item.tenantId.toString() : null,
      routingStatus: item.routingStatus,
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
