import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, AppModule } from '../models';

@Injectable({ providedIn: 'root' })
export class ModuleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/modules`;

  list(params?: Record<string, string>): Observable<ApiResponse<AppModule[]>> {
    return this.http.get<ApiResponse<AppModule[]>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<ApiResponse<AppModule>> {
    return this.http.get<ApiResponse<AppModule>>(`${this.baseUrl}/${id}`);
  }

  create(payload: Partial<AppModule>): Observable<ApiResponse<AppModule>> {
    return this.http.post<ApiResponse<AppModule>>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<AppModule>): Observable<ApiResponse<AppModule>> {
    return this.http.put<ApiResponse<AppModule>>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
