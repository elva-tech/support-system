export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TicketSlaCycleView {
  cycleNumber: number;
  startedAt?: string;
  responseDueAt?: string;
  resolutionDueAt?: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  responseState?: string;
  resolutionState?: string;
  responsePercent?: number;
  resolutionPercent?: number;
  responseBreachedAt?: string | null;
  resolutionBreachedAt?: string | null;
  remainingResolutionMinutes?: number;
  triggeredThresholds?: string[];
}

export interface TicketSlaStatus {
  priority?: TicketPriority;
  hasSla: boolean;
  currentCycle?: TicketSlaCycleView | null;
}

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
  priority?: TicketPriority;
  assignedTo?: TicketAssigneeRef | string | null;
  assignedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  reopenedAt?: string | null;
  slaStatus?: TicketSlaStatus;
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
