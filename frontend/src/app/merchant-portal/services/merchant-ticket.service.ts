import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MerchantApiResponse } from '../models/merchant.models';
import { MerchantModuleOption, Ticket, TicketStats } from '../../core/models/ticket.model';
import { TimelineItem } from '../../core/models/conversation.model';

export interface CreateTicketPayload {
  moduleId: string;
  subject: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class MerchantTicketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/merchant/tickets`;

  listModules(): Observable<MerchantApiResponse<MerchantModuleOption[]>> {
    return this.http.get<MerchantApiResponse<MerchantModuleOption[]>>(`${this.baseUrl}/modules`);
  }

  getStats(): Observable<MerchantApiResponse<TicketStats>> {
    return this.http.get<MerchantApiResponse<TicketStats>>(`${this.baseUrl}/stats`);
  }

  list(): Observable<MerchantApiResponse<Ticket[]>> {
    return this.http.get<MerchantApiResponse<Ticket[]>>(this.baseUrl);
  }

  getById(id: string): Observable<MerchantApiResponse<Ticket>> {
    return this.http.get<MerchantApiResponse<Ticket>>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateTicketPayload): Observable<MerchantApiResponse<Ticket>> {
    return this.http.post<MerchantApiResponse<Ticket>>(this.baseUrl, payload);
  }

  getTimeline(id: string): Observable<MerchantApiResponse<TimelineItem[]>> {
    return this.http.get<MerchantApiResponse<TimelineItem[]>>(`${this.baseUrl}/${id}/timeline`);
  }

  reply(id: string, message: string): Observable<MerchantApiResponse<unknown>> {
    return this.http.post<MerchantApiResponse<unknown>>(`${this.baseUrl}/${id}/reply`, { message });
  }

  uploadAttachment(id: string, file: File): Observable<MerchantApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MerchantApiResponse<unknown>>(`${this.baseUrl}/${id}/attachments`, formData);
  }
}
