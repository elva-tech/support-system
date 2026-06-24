import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Team } from '../models';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/teams`;

  list(params?: Record<string, string>): Observable<ApiResponse<Team[]>> {
    return this.http.get<ApiResponse<Team[]>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<ApiResponse<Team>> {
    return this.http.get<ApiResponse<Team>>(`${this.baseUrl}/${id}`);
  }

  create(payload: Partial<Team>): Observable<ApiResponse<Team>> {
    return this.http.post<ApiResponse<Team>>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<Team>): Observable<ApiResponse<Team>> {
    return this.http.put<ApiResponse<Team>>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
