import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';
import { AgentDashboardMetrics, TeamWorkloadItem } from '../models/operations.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/dashboard`;

  getAgentMetrics(): Observable<ApiResponse<AgentDashboardMetrics>> {
    return this.http.get<ApiResponse<AgentDashboardMetrics>>(`${this.baseUrl}/agent`);
  }

  getTeamWorkload(teamId?: string): Observable<ApiResponse<TeamWorkloadItem[]>> {
    const params = teamId ? { teamId } : undefined;
    return this.http.get<ApiResponse<TeamWorkloadItem[]>>(`${this.baseUrl}/team-workload`, { params });
  }
}
