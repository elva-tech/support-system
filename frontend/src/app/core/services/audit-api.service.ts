import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TenantAuditLog {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorId?: string | null;
  actorName: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  tenantId?: string;
}

export interface AuditPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/audit`;

  list(params?: Record<string, string>): Observable<{ data: TenantAuditLog[]; pagination: AuditPagination }> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, v);
        }
      });
    }
    return this.http.get<{ data: TenantAuditLog[]; pagination: AuditPagination }>(this.baseUrl, {
      params: httpParams
    });
  }

  getById(id: string): Observable<{ data: TenantAuditLog }> {
    return this.http.get<{ data: TenantAuditLog }>(`${this.baseUrl}/${id}`);
  }
}
