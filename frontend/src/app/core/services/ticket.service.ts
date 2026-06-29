import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models';
import { Ticket, TicketStatus } from '../models/ticket.model';
import { TimelineItem } from '../models/conversation.model';
import { TicketAssignee } from '../models/operations.model';
import { ApiResponse } from '../models';

export interface TicketListParams {
  page?: number;
  limit?: number;
  search?: string;
  application?: string;
  module?: string;
  team?: string;
  status?: string;
  assignedTo?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tickets`;

  private toQueryParams(params?: TicketListParams): Record<string, string> {
    if (!params) return {};
    const query: Record<string, string> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query[key] = String(value);
      }
    });
    return query;
  }

  list(params?: TicketListParams): Observable<PaginatedResponse<Ticket[]>> {
    return this.http.get<PaginatedResponse<Ticket[]>>(this.baseUrl, { params: this.toQueryParams(params) });
  }

  listMy(params?: TicketListParams): Observable<PaginatedResponse<Ticket[]>> {
    return this.http.get<PaginatedResponse<Ticket[]>>(`${this.baseUrl}/my`, {
      params: this.toQueryParams(params)
    });
  }

  listTeam(params?: TicketListParams): Observable<PaginatedResponse<Ticket[]>> {
    return this.http.get<PaginatedResponse<Ticket[]>>(`${this.baseUrl}/team`, {
      params: this.toQueryParams(params)
    });
  }

  getById(id: string): Observable<ApiResponse<Ticket>> {
    return this.http.get<ApiResponse<Ticket>>(`${this.baseUrl}/${id}`);
  }

  getTimeline(id: string): Observable<ApiResponse<TimelineItem[]>> {
    return this.http.get<ApiResponse<TimelineItem[]>>(`${this.baseUrl}/${id}/timeline`);
  }

  reply(id: string, message: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/${id}/reply`, { message });
  }

  addInternalNote(id: string, message: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/${id}/internal-note`, { message });
  }

  updateStatus(id: string, status: TicketStatus, closureNotes?: string): Observable<ApiResponse<Ticket>> {
    return this.http.patch<ApiResponse<Ticket>>(`${this.baseUrl}/${id}/status`, {
      status,
      ...(closureNotes ? { closureNotes } : {})
    });
  }

  transfer(id: string, teamId: string): Observable<ApiResponse<Ticket>> {
    return this.http.patch<ApiResponse<Ticket>>(`${this.baseUrl}/${id}/transfer`, { teamId });
  }

  uploadAttachment(id: string, file: File): Observable<ApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/${id}/attachments`, formData);
  }

  assign(id: string, userId: string): Observable<ApiResponse<Ticket>> {
    return this.http.patch<ApiResponse<Ticket>>(`${this.baseUrl}/${id}/assign`, { userId });
  }

  getAssignableAgents(id: string): Observable<ApiResponse<TicketAssignee[]>> {
    return this.http.get<ApiResponse<TicketAssignee[]>>(`${this.baseUrl}/${id}/assignable-agents`);
  }
}
