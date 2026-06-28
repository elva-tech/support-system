export type UserRole = 'ADMIN' | 'TEAM_LEAD' | 'AGENT';

export interface ApplicationRef {
  _id: string;
  name: string;
  code: string;
}

export interface TeamRef {
  _id: string;
  name: string;
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  role: UserRole;
  teamId?: TeamRef | string | null;
  applicationIds?: ApplicationRef[] | string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Application {
  _id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppModule {
  _id: string;
  name: string;
  code: string;
  applicationId: ApplicationRef | string;
  defaultTeamId?: TeamRef | string | null;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Team {
  _id: string;
  name: string;
  description: string;
  applicationId: ApplicationRef | string;
  moduleIds: (AppModule | string)[];
  teamLeadId?: User | string | null;
  memberIds: (User | string)[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Merchant {
  _id: string;
  email: string;
  merchantName: string;
  applicationId: ApplicationRef | string;
  applicationCode: string;
  phone?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  message?: string;
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  message?: string;
  data: T;
  pagination: PaginationMeta;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  message: string;
  errors?: ValidationError[];
}

export interface LoginResponse {
  message: string;
  data: {
    token: string;
    user: User;
  };
}

export type InboundMailQueueStatus = 'PENDING' | 'ASSIGNED' | 'REJECTED';

export interface InboundMailAttachment {
  _id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface InboundMailQueueItem {
  _id: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  attachments: InboundMailAttachment[];
  status: InboundMailQueueStatus;
  assignedTeamId?: TeamRef | string | null;
  assignedApplicationId?: ApplicationRef | string | null;
  assignedModuleId?: { _id: string; name: string; code: string } | string | null;
  ticketId?: { _id: string; ticketNumber: string; status: string } | string | null;
  adminNotes?: string;
  rejectReason?: string;
  createdAt: string;
  reviewedAt?: string | null;
}
