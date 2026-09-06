import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';
import {
  CentralSupportAuthService,
  CentralSupportUser
} from './central-support-auth.service';

export interface CentralSupportLoginRequest {
  email: string;
  password: string;
}

export interface CentralSupportLoginResponse {
  message: string;
  data: {
    token: string;
    user: CentralSupportUser;
  };
}

@Injectable({ providedIn: 'root' })
export class CentralSupportAuthApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(CentralSupportAuthService);
  private readonly baseUrl = `${environment.apiUrl}/central-support/auth`;

  login(credentials: CentralSupportLoginRequest): Observable<CentralSupportLoginResponse> {
    return this.http
      .post<CentralSupportLoginResponse>(`${this.baseUrl}/login`, credentials)
      .pipe(tap((res) => this.auth.setSession(res.data.token, res.data.user)));
  }

  getMe(): Observable<ApiResponse<CentralSupportUser>> {
    return this.http.get<ApiResponse<CentralSupportUser>>(`${this.baseUrl}/me`).pipe(
      tap((res) => this.auth.updateUser(res.data))
    );
  }
}
