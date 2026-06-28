import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, InboundMailQueueItem, PaginatedResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class InboundMailQueueService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/inbound-mail-queue`;

  list(params?: Record<string, string>): Observable<PaginatedResponse<InboundMailQueueItem[]>> {
    return this.http.get<PaginatedResponse<InboundMailQueueItem[]>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<ApiResponse<InboundMailQueueItem>> {
    return this.http.get<ApiResponse<InboundMailQueueItem>>(`${this.baseUrl}/${id}`);
  }

  assign(
    id: string,
    payload: { teamId: string; applicationId: string; moduleId: string; notes?: string }
  ): Observable<ApiResponse<InboundMailQueueItem>> {
    return this.http.post<ApiResponse<InboundMailQueueItem>>(`${this.baseUrl}/${id}/assign`, payload);
  }

  reject(id: string, reason: string): Observable<ApiResponse<InboundMailQueueItem>> {
    return this.http.post<ApiResponse<InboundMailQueueItem>>(`${this.baseUrl}/${id}/reject`, { reason });
  }

  downloadAttachment(queueItemId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${queueItemId}/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    });
  }

  triggerDownload(queueItemId: string, attachmentId: string, fileName: string): void {
    this.downloadAttachment(queueItemId, attachmentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        window.URL.revokeObjectURL(url);
      }
    });
  }
}
