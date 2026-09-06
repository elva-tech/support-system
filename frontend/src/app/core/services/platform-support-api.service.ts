import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export interface PlatformSupportContext {
  organizationName: string;
  workspace: string;
  workspaceSlug: string;
  raisedByName: string;
  email: string;
  role: string;
  categories: { code: string; label: string }[];
  priorities: string[];
}

export interface PlatformSupportTicket {
  id: string;
  ticketNumber: string;
  status: string;
  priority: string;
  category: string;
  categoryLabel?: string;
  subject: string;
  description: string;
  sourceTenantId: string;
  sourceTenantSlug: string;
  sourceOrganizationName: string;
  sourceWorkspaceUrl: string;
  raisedByUserId: string;
  raisedByName: string;
  raisedByEmail: string;
  raisedByRole: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedTeamId?: string | null;
  assignedTeamName?: string | null;
  /** @deprecated Prefer assignedUserId — kept for older payloads */
  assignedPlatformAdminId?: string | null;
  /** @deprecated Prefer assignedUserName — kept for older payloads */
  assignedPlatformAdminName?: string | null;
  assignedAt?: string | null;
  sla?: {
    currentCycle?: {
      responseState?: string;
      resolutionState?: string;
      responseDueAt?: string;
      resolutionDueAt?: string;
      responseTargetMinutes?: number;
      resolutionTargetMinutes?: number;
    } | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformSupportTimelineItem {
  id: string;
  ticketId: string;
  type: string;
  senderType: string;
  senderName: string;
  message: string;
  createdAt: string;
  isInitial?: boolean;
  attachment?: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    downloadUrl: string;
  };
}

@Injectable({ providedIn: 'root' })
export class PlatformSupportApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/platform-support`;

  getContext(): Observable<ApiResponse<PlatformSupportContext>> {
    return this.http.get<ApiResponse<PlatformSupportContext>>(`${this.base}/context`);
  }

  listMine(params?: { status?: string; search?: string }): Observable<ApiResponse<PlatformSupportTicket[]>> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    return this.http.get<ApiResponse<PlatformSupportTicket[]>>(`${this.base}/tickets`, {
      params: httpParams
    });
  }

  create(payload: {
    category: string;
    subject: string;
    description: string;
    priority?: string;
  }): Observable<ApiResponse<PlatformSupportTicket>> {
    return this.http.post<ApiResponse<PlatformSupportTicket>>(`${this.base}/tickets`, payload);
  }

  get(id: string): Observable<ApiResponse<PlatformSupportTicket>> {
    return this.http.get<ApiResponse<PlatformSupportTicket>>(`${this.base}/tickets/${id}`);
  }

  timeline(id: string): Observable<
    ApiResponse<{ ticket: PlatformSupportTicket; timeline: PlatformSupportTimelineItem[] }>
  > {
    return this.http.get<
      ApiResponse<{ ticket: PlatformSupportTicket; timeline: PlatformSupportTimelineItem[] }>
    >(`${this.base}/tickets/${id}/timeline`);
  }

  reply(id: string, message: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/tickets/${id}/messages`, { message });
  }

  upload(id: string, file: File): Observable<ApiResponse<unknown>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<unknown>>(`${this.base}/tickets/${id}/attachments`, fd);
  }
}
