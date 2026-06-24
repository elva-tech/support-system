export interface AgentDashboardMetrics {
  assignedToMe: number;
  openTickets: number;
  waitingForCustomer: number;
  resolvedToday: number;
  ticketsCreatedToday: number;
  ticketsResolvedToday: number;
  averageResolutionTime: number;
}

export interface TeamWorkloadItem {
  userId: string;
  name: string;
  teamId?: string;
  teamName?: string;
  ticketCount: number;
}

export interface TicketAssignee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}
