import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';
import { CentralSupportRole, CentralSupportUser } from './central-support-auth.service';
import {
  PlatformSupportTicket,
  PlatformSupportTimelineItem
} from './platform-support-api.service';

export interface CentralSupportTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface CentralSupportTeam {
  id: string;
  name: string;
  description: string;
  teamLeadId: string | null;
  teamLeadName: string | null;
  memberIds: string[];
  members: CentralSupportTeamMember[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CentralSupportAssignee {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId?: string | null;
}

export interface CreateCentralSupportAgentRequest {
  name: string;
  email: string;
  password: string;
  role: CentralSupportRole;
  teamId?: string | null;
}

export interface UpdateCentralSupportAgentRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: CentralSupportRole;
  status?: string;
  teamId?: string | null;
}

export interface CreateCentralSupportTeamRequest {
  name: string;
  description?: string;
  teamLeadId?: string | null;
  memberIds?: string[];
}

export interface UpdateCentralSupportTeamRequest {
  name?: string;
  description?: string;
  teamLeadId?: string | null;
  memberIds?: string[];
  isActive?: boolean;
}

export interface AssignCentralSupportTicketRequest {
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
  unassign?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CentralSupportApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/central-support`;

  listTickets(
    query: Record<string, string | number | boolean | undefined> = {}
  ): Observable<ApiResponse<{ items: PlatformSupportTicket[]; total: number; limit?: number; skip?: number }>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<
      ApiResponse<{ items: PlatformSupportTicket[]; total: number; limit?: number; skip?: number }>
    >(`${this.baseUrl}/tickets`, { params });
  }

  getTicket(id: string): Observable<ApiResponse<PlatformSupportTicket>> {
    return this.http.get<ApiResponse<PlatformSupportTicket>>(`${this.baseUrl}/tickets/${id}`);
  }

  getTimeline(id: string): Observable<
    ApiResponse<{ ticket: PlatformSupportTicket; timeline: PlatformSupportTimelineItem[] }>
  > {
    return this.http.get<
      ApiResponse<{ ticket: PlatformSupportTicket; timeline: PlatformSupportTimelineItem[] }>
    >(`${this.baseUrl}/tickets/${id}/timeline`);
  }

  listAssignees(): Observable<ApiResponse<CentralSupportAssignee[]>> {
    return this.http.get<ApiResponse<CentralSupportAssignee[]>>(
      `${this.baseUrl}/tickets/assignees`
    );
  }

  assignTicket(id: string, body: AssignCentralSupportTicketRequest): Observable<ApiResponse<PlatformSupportTicket>> {
    return this.http.patch<ApiResponse<PlatformSupportTicket>>(
      `${this.baseUrl}/tickets/${id}/assign`,
      body
    );
  }

  updateStatus(id: string, status: string): Observable<ApiResponse<PlatformSupportTicket>> {
    return this.http.patch<ApiResponse<PlatformSupportTicket>>(
      `${this.baseUrl}/tickets/${id}/status`,
      { status }
    );
  }

  reply(id: string, message: string, internal = false): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/tickets/${id}/messages`, {
      message,
      internal
    });
  }

  listAgents(query: { status?: string; role?: string; teamId?: string } = {}): Observable<
    ApiResponse<CentralSupportUser[]>
  > {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiResponse<CentralSupportUser[]>>(`${this.baseUrl}/agents`, { params });
  }

  createAgent(body: CreateCentralSupportAgentRequest): Observable<ApiResponse<CentralSupportUser>> {
    return this.http.post<ApiResponse<CentralSupportUser>>(`${this.baseUrl}/agents`, body);
  }

  updateAgent(
    id: string,
    body: UpdateCentralSupportAgentRequest
  ): Observable<ApiResponse<CentralSupportUser>> {
    return this.http.patch<ApiResponse<CentralSupportUser>>(`${this.baseUrl}/agents/${id}`, body);
  }

  listTeams(includeInactive = false): Observable<ApiResponse<CentralSupportTeam[]>> {
    let params = new HttpParams();
    if (includeInactive) {
      params = params.set('includeInactive', 'true');
    }
    return this.http.get<ApiResponse<CentralSupportTeam[]>>(`${this.baseUrl}/teams`, { params });
  }

  createTeam(body: CreateCentralSupportTeamRequest): Observable<ApiResponse<CentralSupportTeam>> {
    return this.http.post<ApiResponse<CentralSupportTeam>>(`${this.baseUrl}/teams`, body);
  }

  updateTeam(
    id: string,
    body: UpdateCentralSupportTeamRequest
  ): Observable<ApiResponse<CentralSupportTeam>> {
    return this.http.patch<ApiResponse<CentralSupportTeam>>(`${this.baseUrl}/teams/${id}`, body);
  }

  deactivateTeam(id: string): Observable<ApiResponse<CentralSupportTeam>> {
    return this.http.delete<ApiResponse<CentralSupportTeam>>(`${this.baseUrl}/teams/${id}`);
  }
}
