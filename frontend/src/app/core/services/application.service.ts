import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Application } from '../models';

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/applications`;

  list(params?: Record<string, string>): Observable<ApiResponse<Application[]>> {
    return this.http.get<ApiResponse<Application[]>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<ApiResponse<Application>> {
    return this.http.get<ApiResponse<Application>>(`${this.baseUrl}/${id}`);
  }

  create(payload: Partial<Application>): Observable<ApiResponse<Application>> {
    return this.http.post<ApiResponse<Application>>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<Application>): Observable<ApiResponse<Application>> {
    return this.http.put<ApiResponse<Application>>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
