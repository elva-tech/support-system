import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Merchant } from '../models';

export interface CreateMerchantPayload {
  applicationId: string;
  email: string;
  merchantName?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UpdateMerchantPayload {
  applicationId?: string;
  email?: string;
  merchantName?: string;
  phone?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MerchantAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/merchants`;

  list(params?: Record<string, string>): Observable<ApiResponse<Merchant[]>> {
    return this.http.get<ApiResponse<Merchant[]>>(this.baseUrl, { params });
  }

  create(payload: CreateMerchantPayload): Observable<ApiResponse<Merchant>> {
    return this.http.post<ApiResponse<Merchant>>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateMerchantPayload): Observable<ApiResponse<Merchant>> {
    return this.http.put<ApiResponse<Merchant>>(`${this.baseUrl}/${id}`, payload);
  }
}
