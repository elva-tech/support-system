export type ConversationType = 'MESSAGE' | 'INTERNAL_NOTE' | 'SYSTEM' | 'ATTACHMENT';
export type SenderType = 'MERCHANT' | 'AGENT' | 'SYSTEM';

export interface TicketAttachment {
  _id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  driveFileId: string;
  driveUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TimelineItem {
  _id: string;
  ticketId?: string;
  type: ConversationType;
  senderType: SenderType;
  senderId?: string | null;
  senderName: string;
  message: string;
  createdAt: string;
  isInitial?: boolean;
  attachments?: TicketAttachment[];
  attachment?: TicketAttachment;
}
