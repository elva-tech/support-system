export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export interface TicketRef {
  _id: string;
  name: string;
  code?: string;
}

export interface TicketMerchantRef {
  _id: string;
  merchantName: string;
  email: string;
}

export interface TicketAssigneeRef {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: string;
}

export interface Ticket {
  _id: string;
  ticketNumber: string;
  applicationId: TicketRef | string;
  applicationCode: string;
  moduleId: TicketRef | string;
  merchantId: TicketMerchantRef | string;
  teamId: TicketRef | string;
  subject: string;
  description: string;
  status: TicketStatus;
  assignedTo?: TicketAssigneeRef | string | null;
  assignedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketStats {
  open: number;
  resolved: number;
  closed: number;
}

export interface MerchantModuleOption {
  _id: string;
  name: string;
  code: string;
  defaultTeamId?: string | null;
}
