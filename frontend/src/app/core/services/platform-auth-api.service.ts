import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';
import { PlatformAdmin, PlatformAuthService } from './platform-auth.service';

export interface PlatformLoginRequest {
  email: string;
  password: string;
}

export interface PlatformLoginResponse {
  message: string;
  data: {
    token: string;
    admin: PlatformAdmin;
  };
}

@Injectable({ providedIn: 'root' })
export class PlatformAuthApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(PlatformAuthService);
  private readonly baseUrl = `${environment.apiUrl}/platform/auth`;

  login(credentials: PlatformLoginRequest): Observable<PlatformLoginResponse> {
    return this.http.post<PlatformLoginResponse>(`${this.baseUrl}/login`, credentials).pipe(
      tap((res) => this.auth.setSession(res.data.token, res.data.admin))
    );
  }

  getMe(): Observable<ApiResponse<PlatformAdmin>> {
    return this.http.get<ApiResponse<PlatformAdmin>>(`${this.baseUrl}/me`).pipe(
      tap((res) => this.auth.updateAdmin(res.data))
    );
  }
}
